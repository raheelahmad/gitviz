const d3 = Object.assign({},
                         require('d3-selection'), require('d3-shape'), require('d3-scale'),
                         require('d3-format'), require('d3-time-format'),
                         require('d3-axis'), require('d3-time-format'),
                         require('d3-array'), require('d3-jetpack'))
import {SubNav, SubNavItem, addSubNav, removeSubNav} from '../../helpers/nav.js'
import * as m from '../../helpers/metrics.js'
import * as timeline from './timeline.js'
import * as rhythms from './rhythms.js'
import * as setup from '../../helpers/setup.js'

export function currentCommitsViz() {
    return d3.select('#selected-view')
        .select('a').attr('name')
}

export function transitionFromCommitsViz() {
    m.chart.selectAll('*').remove()
    removeSubNav(subNav)
}

let subNav // should be assigned in setupSubViz

function setupSubViz(commits, authors, timeExtent, lineStats) {
    subNav = new SubNav([
        new SubNavItem('timeline',
                       'Timeline',
                       'All commits by top authors',
                       () => timeline.renderTimeline(commits, authors, timeExtent, lineStats),
                       () => timeline.transitionFromTimeline()),
        new SubNavItem('rhythm-hour',
                       'Hourly',
                       'What time of day do authors commit their work?',
                       () => rhythms.renderRhythms(commits, authors, timeExtent, lineStats, setup.hourOfDayType),
                       () => rhythms.transitionFromRhythm()),
        new SubNavItem('rhythm-week',
                       'Weekly',
                       'What day of the week do authors commit their work?',
                       () => rhythms.renderRhythms(commits, authors, timeExtent, lineStats, setup.dayOfWeekType),
                       () => rhythms.transitionFromRhythm())
    ])
    addSubNav(subNav)
}

export function setupCommitsViz(data) {
    // Set up low commit authors & transform dates
    const commits = data.commits
    let authors = data.authors
    const lowerCommitAuthors = data.low_commit_authors
    if (lowerCommitAuthors.length) {
        // if there is an array of authors representing those with low # of commits,
        // add it to main authors array but with 'emails' & 'names'
        const lowerCommitAuthorsObj = {
            emails: lowerCommitAuthors.map((a) => a.email),
            names: lowerCommitAuthors.map((a) => a.name),
            name: lowerCommitAuthors.reduce(((a, b) => a + b.name), ', '),
            email: lowerCommitAuthors.map((a) => a.email).join(','),
            commits: lowerCommitAuthors.reduce((a, b) => a.concat(b.commits), []),
            isLowerCommitAuthor: true
        }
        authors.push(lowerCommitAuthorsObj)
    }
    commits.forEach(d => {
        d.time = new Date(d.time)
    })
}

export function renderCommitsViz(data) {
    const authors = data.authors
    const commits = data.commits
    const timeExtent = data.time_extent.map(d => new Date(d))
    const lineStats = data.line_stats

    // show timeline first, by default
    timeline.renderTimeline(commits, authors, timeExtent, lineStats)
    setupSubViz(commits, authors, timeExtent, lineStats)
}
