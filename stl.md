---
layout: d3post
title: How STL Works
include_scripts: [
  "https://cdn.jsdelivr.net/npm/d3@7",
  "/assets/js/seasonal_d3.js"
]
---

# Using STL

STL is a classic method to decompose a time series into its constituent
components: the Trend, the Seasonal and the Residual. It was introduced by
Cleveland et al. in a 1990 paper (see references below). STL is used because it
is straightforward to use (only a couple of parameters need to be specified),
and has enough variability to cover lots of different time series shapes.

While STL is a great all-around TS decomposition method, it does have its
downsides. To better decide when to use STL and when to look for an
alternative, it is useful to understand what exactly STL is doing. This post
explains how STL works according to the original definition.

There are three important implementations of STL. The first is the original
[Fortran 77 implementation][1] by two of the original authors of the STl
paper, Cleveland and Cleveland. The most commonly used one is probably the [R
function STL][2]. And finally the one we will be using in our examples, the
Python implementation in the `statsmodels` library [here][3]. These three
implementations are very similar to each other, and importantly, all three
diverge from the original definition in that they don't support time series
with missing values or loess smoothing with degree 2 or larger.

## Our Data

The data for our example is a [classic dataset][4]. We will take the monthly
average Mauna Loa Observatory CO2 measurements from January 1959 to December
1986, just like in the original paper. We can use Pandas to read the CSV file
directly, and then after a couple of manipulations, we'll have a single
Series object with one observation per month.

```python
st = pd.Timestamp(year=1959, month=1, day=1)
en = pd.Timestamp(year=1986, month=12, day=31)

co2_month = (pd

    #Read in the data:
    .read_csv('co2_mm_mlo.csv', 
              skiprows=41, 
              names=['year','month','decimal date','co2','deseasonalized',
                     'ndays','sdev','unc'],
              usecols=['year', 'month', 'co2'])

    # Create the DatetimeIndex:
    .assign(day=1,
            month=lambda df: pd.to_datetime(df[['year', 'month', 'day']]))
    .set_index('month')

    # Filter for only the data we need:
    .loc[st:en, 'co2']
)
```

![Data](/assets/co2.png)

For convenience, let's call our time series **Y**:

```python
Y = co2_month.rename('observed')
```

Our time series, **Y** is a monthly series with a yearly cycle, which means
that the length of the cycle is 12 observations. This is an important
parameter for the STL decomposition. The original paper calls it
n<sub>(p)</sub> and `statsmodels` calls it `period`.

## The STL Loop

STL decomposition consists of two loops, called the outer loop and the inner
loop. Most of the action takes place in the inner loop, while the outer loop,
which is optional, is used to make the decompostion robust against outliers.

So let's take a look at the inner loop. The first thing we'll do is think of
our time series as a collection of n<sub>(p)</sub> seasonal cycle-subseries.
Which means that we will split **Y**
into 12 cycle-subseries. One for January, one for February, and so on. We
expect each one of the cycle-subseries to be roughly parallel to the trend:

![Cycle-subseries](/assets/co2-subseries.png)

### 1. Smoothing the Cycle-Subseries

The next step is to smooth each of the cycle-subseries. We do this with a
Loess regression of order 1. Cleveland et al. call the smoothing parameter
n<sub>(s)</sub>, and `statsmodels` call it `seasonal`.

```python
subcycles = (Y
    .reset_index(drop=True)
    .groupby(lambda ix: ix % period)
)
smooth_subcycles = [loess_smoothing(subcycle[1], seasonal, xtra_vals=1)
                    for subcycle in subcycles]
C = pd.concat(smooth_subcycles).sort_index()
```

After smoothing, the plot above looks like this:

<div id="seasonal-d3">
    <input type="range" id="nsubp" name="nsubp" list="values" min="0" max="6" step="1" value="0" style="width:200px; margin:0;"/>

    {% include datalist.html labels="0 5 11 17 23 29 35" %}
</div>

Once each cycle-subseries has been smoothed, we combine each them again into
a single series we'll call **C**. Like many smoothing methods, loess is less
accurate at the edges of the data. Nevertheless, we are going to extend the
series **C** by one full period in each direction. In our case, this means
that **C** will go from January 1958 to December 1988, one more year on each
end. We will need it in the next step.


### 2. The Low-Pass Filter

Next, we are going to smooth the **C** series to create a new series called
**L**.  The stages of the low-pass filter are: 

1. A moving average of length n<sub>(p)</sub>.
2. A second moving average of length n<sub>(p)</sub>. Two moving averages
   make sure this filter is symmetric even if n<sub>(p)</sub> is even.
3. A moving average of length 3.
4. A Loess smoothing with smoothing parameter n<sub>(l)</sub> (`low_pass`
   in `statsmodels`).

```python
def low_pass_filter(X, n_p, n_l):
    res = (X
        .rolling(n_p, center=True).mean()
        .rolling(n_p, center=True).mean()
        .rolling(3, center=True).mean()
        .shift(-1)
        .dropna()
    )
    return loess_smoothing(res, n_l)
```

The n<sub>(l)</sub> parameter should be set to the smallest odd integer larger
than n<sub>(p)</sub>. In our case, this will mean that n<sub>(l)</sub> is 13.
Here is how the **C** series looks next to its smoothed counterpart, **L**:

![C and L](/assets/low-pass.png)

Finally, we can set the Seasonal component for this iteration of the loop to
**S** = **C** - **L**. This finally looks like a detrended seasonal cycle!

![Seasonal](/assets/seasonal.png)


### 3. Calculating the Trend

Finally, to calculate the Trend, we take the deseasonalised series, **Y** -
**S** and run it through a loess smoothing with smoothing parameter 
n<sub>(t)</sub> (called `trend` in `statsmodels`). The value of
n<sub>(t)</sub> should be set to the smallest odd integer greater than 1.5 *
n<sub>(p)</sub> / (1 - 1.5 / n<sub>(s)</sub>). If we take n<sub>(s)</sub>=35,
and n<sub>(p)</sub>=12, this means that n<sub>(t)</sub>=19.

This completes one run through this decomposition. We can now rinse and
repeat, using the de-trended series to begin again in step 1. We can put it
all together like this:

```python
def inner_loop(Y, T, seasonal, period, low_pass, trend):
    subcycles = ((Y-T)
        .reset_index(drop=True)
        .groupby(lambda ix: ix % period)
    )
    C = pd.concat([loess_smoothing(subcycle[1], seasonal, xtra_vals=1)
                   for subcycle in subcycles]
    ).sort_index()
    L = low_pass_filter(C, period, low_pass)
    S = (C-L).dropna().set_axis(Y.index).rename('seasonal')
    T = loess_smoothing(Y-S, trend).rename('trend')
    return T, S


def stl_decomposition(Y, seasonal, period, low_pass, trend, iter_count):
    T = pd.Series(0, index=Y.index)
    for _ in range(iter_count):
        T, S = inner_loop(Y, T, seasonal, period, low_pass, trend)

    return (
        T, S, (Y-T-S).rename('resid')
    )
```

And if we decompose our original series, we get the following picture:

```python
seasonal = 35
period = 12
low_pass = 13
trend = 19
inner_iter = 5

T, S, R = stl_decomposition(Y, seasonal, period, low_pass, trend, inner_iter)
```

![Decomposition](/assets/decomposition.png)


## References
R. B. Cleveland, W. S. Cleveland, J.E. McRae, and I. Terpenning (1990) STL: A
Seasonal-Trend Decomposition Procedure Based on LOESS. Journal of Official
Statistics, 6, 3-73

Dr. Xin Lan, NOAA/GML (gml.noaa.gov/ccgg/trends/) and Dr. Ralph Keeling,
Scripps Institution of Oceanography (scrippsco2.ucsd.edu/).

[1]: <https://www.netlib.org/a/stl> "STL Fortran"
[2]: <https://www.rdocumentation.org/packages/stats/versions/3.6.2/topics/stl> "STL R"
[3]: <https://www.statsmodels.org/stable/generated/statsmodels.tsa.seasonal.STL.html#statsmodels.tsa.seasonal.STL> "STL Python"
[4]: <https://gml.noaa.gov/ccgg/trends/data.html> "Mauna Loa CO2 Data"
