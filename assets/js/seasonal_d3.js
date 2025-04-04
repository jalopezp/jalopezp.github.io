// Declare the chart dimensions and margins.
const width = 500;
const height = 400;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 50;
const marginLeft = 40
const chart_dy = height - marginTop - marginBottom;
const chart_dx = width - marginRight - marginLeft;

// Declare the x (horizontal position) scale.
const x = d3.scaleUtc()
    .domain([new Date("1958-01-01"), new Date("1989-03-31")])
    .range([marginLeft, width - marginRight]);

// Declare the y (vertical position) scale.
const y = d3.scaleLinear()
    .domain([310, 352])
    .range([height - marginBottom, marginTop]);

// Declare the line generator. 
const line = d3.line()
    .x(d => x(new Date(d.month)))
    .y(d => y(d.co2));

// Create the SVG container.
const svg = d3.create("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .classed("svgd3", true);

const xAxis = d3.axisBottom(x)
    .scale(x)
    .tickSizeInner(-chart_dy);

const yAxis = d3.axisLeft(y)
    .scale(y)
    .tickSizeInner(-chart_dx);

xAxis.tickValues([0,1,2,3,4,5,6,7].map(x => new Date(1960+4*x, 1, 1)))
    .tickFormat(x => x.getFullYear());
yAxis.ticks(8);

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
function add_line(svg, linedata, month_name) { 

    const tooltip = svg.append("g");

    tooltip
        .attr("visibility", "hidden")
        .attr("class", "tooltip")
        .append("text")
        .text(month_name);

    const bbox = tooltip.node().getBBox();

    tooltip.insert("rect", "text")
        .attr("x", bbox.x - 2)
        .attr("y", bbox.y - 2)
        .attr("width", bbox.width + 4)
        .attr("height", bbox.height + 2)
        .attr("class", "textbg");

    svg.append("path")
        .attr("fill", "none")
        .attr("d", line(linedata))
        .attr("class", "plotline")
        .on("mouseenter", function(event) {
            event.target.classList.add("highlighted");
            tooltip
                .attr("transform", `translate(${event.offsetX-50}, ${event.offsetY})`)
                .attr("visibility", "visible");
        })
        .on("mouseleave", function(event) {
            event.target.classList.remove("highlighted");
            tooltip
                .attr("visibility", "hidden");
        });

    return svg
}

// Append the SVG element.
const container = document.getElementById('seasonal-d3');
container.append(svg.node())

function draw_plot(svg, n_p) {
    co2_data.then(function (data) {
            for (let month in data[n_p]) {
                add_line(svg, data[n_p][month], month);
            }
            d3.selectAll("g.tooltip").raise();
        }
    );
}

function swap_plot(n_p) {
    svg.selectAll('path.plotline').remove();
    svg.selectAll('g.tooltip').remove();
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
        .attr("stroke", "royalblue")
        .attr("stroke-width", "2.5")
        .attr("d", line(tst))
        .attr("class", "rawplot");

    draw_plot(svg, 1);
});

