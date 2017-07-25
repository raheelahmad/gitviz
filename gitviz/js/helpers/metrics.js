var d3 = Object.assign({}, require('d3-selection'), require('d3-shape'), require('d3-transition'), require('d3-array'), require('d3-jetpack'))
// metrics
const outerWidth = window.innerWidth || 1560,
      outerHeight = window.innerHeight || 800
export const margin = { top: 40, right: 30, bottom: 60, left: 50 },
      width = (outerWidth - 200) - margin.left - margin.right,
      height = (outerHeight - 80) - margin.top - margin.bottom,
      authorsWidth = 200,
      ySep = 0 // y separation between insertion & deletion commit rects

// core elements
const svg = d3.select('div#viz')
      .append('svg')
      .at({ width: width + margin.left + margin.right, height: height + margin.top + margin.bottom })
export const chart = svg.append('g')
      .translate([margin.left, margin.top])
export const mainTransition = d3.transition(4000)

export function addMouseoverRect(yOffset = 0) {
      chart.selectAll('rect#mouseover')
            .data([1]).enter()
            .append('rect#mouseover')
      const mouseoverRect = chart.selectAll('rect#mouseover')
            .st({ fill: 'none' })
            .at({ y: yOffset, width: width, height: height - yOffset })
      return mouseoverRect
}
