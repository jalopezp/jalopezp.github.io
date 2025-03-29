// Declare the chart dimensions and margins.
const width = 640;
const height = 400;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 50;
const marginLeft = 40
const chart_dy = height - marginTop - marginBottom;
const chart_dx = width - marginRight - marginLeft;

// Declare the x (horizontal position) scale.
const x = d3.scaleUtc()
    .domain([new Date("1959-01-01"), new Date("1986-12-31")])
    .range([marginLeft, width - marginRight]);

// Declare the y (vertical position) scale.
const y = d3.scaleLinear()
    .domain([310, 355])
    .range([height - marginBottom, marginTop]);

// Declare the line generator. 
const line = d3.line()
    .x(d => x(new Date(d.month)))
    .y(d => y(d.co2));

// Create the SVG container.
const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height);

const xAxis = d3.axisBottom(x)
    .scale(x)
    .tickSize(-chart_dy);

const yAxis = d3.axisLeft(y)
    .scale(y)
    .tickSize(-chart_dx);

// Add the x-axis.
svg.append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(xAxis)

// Add the y-axis.
svg.append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(yAxis);

const co2_data = fetch("assets/seasonal_smoothing.json")
    .then(response => response.json());

const ts = co2_data.then(function(d) {
    const ary = [];
    for (e in d[1]["January"]) {
        for (m in d[1]) {
            ary.push(d[1][m][e]);
        }
    }
    return ary;
})

// Get the data in JSON format
function add_line(svg, linedata) { 

    svg.append("path")
        .attr("fill", "none")
        .attr("fill-opacity", "0.5")
        .attr("stroke", "lightgray")
        .attr("stroke-width", "1.5")
        .attr("d", line(linedata))
        .attr("class", "plotline");

    return svg
}

// Append the SVG element.
const container = document.getElementById('seasonal-d3');
container.append(svg.node())

function draw_plot(svg, n_p) {
    co2_data.then(function (data) {
            for (let month in data[n_p]) {
                add_line(svg, data[n_p][month]);
            }
        }
    );
}

function swap_plot(n_p) {
    svg.selectAll('path.plotline').remove();
    draw_plot(svg, n_p);
}

const slider = document.getElementById('nsubp');
slider.oninput = function() {
    const ary = [1,5,11,17,23,29,35];
    const n_p = ary[this.value];
    swap_plot(n_p);
}

ts.then(function(tst) {
    svg.append("path")
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", "2")
        .attr("d", line(tst))
        .attr("class", "rawplot");
});

draw_plot(svg, 1);
