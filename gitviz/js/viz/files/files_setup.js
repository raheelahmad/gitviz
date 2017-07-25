const d3 = Object.assign({},
                         require('d3-selection'), require('d3-shape'), require('d3-scale'),
                         require('d3-format'), require('d3-time-format'),
                         require('d3-axis'), require('d3-time-format'),
                         require('d3-array'), require('d3-jetpack'))
import {SubNav, SubNavItem, addSubNav, removeSubNav} from '../../helpers/nav.js'
import * as m from '../../helpers/metrics.js'
import * as timeline from './timeline.js'

let subNav

export function transitionFromFilesViz() {
    m.chart.selectAll('*').remove()
    removeSubNav(subNav)
}

export function renderFilesViz(data) {
    transitionToFilesViz()
    const filesWithMaxCommits = data.files_with_max_commits
    const lineStats = data.filestats_line_stats
    const allCommits = data.commits

    timeline.render(filesWithMaxCommits, allCommits, lineStats)
}

function transitionToFilesViz() {
    subNav = new SubNav([
        new SubNavItem('most-commits',
                       'Most Commits',
                       'The most committed files',
                       () => {},
                       () => {})
    ])
    addSubNav(subNav)
}

