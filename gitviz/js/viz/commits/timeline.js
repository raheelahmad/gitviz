const d3 = Object.assign({},
                         require('d3-selection'), require('d3-shape'), require('d3-scale'),
                         require('d3-format'), require('d3-time-format'),
                         require('d3-axis'), require('d3-time-format'),
                         require('d3-array'), require('d3-jetpack'))
import * as m from '../../helpers/metrics.js'
import * as setup from './commits_setup.js'

// scales
const authorsY = d3.scaleBand().rangeRound([0, m.height])
export const timeX = d3.scaleTime()
const stat = d3.scaleLinear()
const overflowInsertionsColor = d3.scaleLinear().range(['#AAAADD', '#020233'])
const overflowDeletionsColor = d3.scaleLinear().range(['#DDAAAA', '#330202'])

const timeFormat = d3.timeFormat('%B %d, %Y') // for commit message

// axes
const axisX = d3.axisBottom(timeX)


export function transitionFromTimeline() {
    m.chart.selectAll('g.authors rect').remove()
    m.chart.select('.timelineAxis').remove()
    m.chart.selectAll('g.authors text.commits-count').remove()
    hideAuthorHover()
}

// --- Rendering

export function renderTimeline(commits, authors, timeExtent, lineStats) {
    // authors
    authorsY.domain(authors.map(author => author.email))
    const maxBandwidth = m.height / 3.0
    if (yBandwidth() > maxBandwidth) {
        // trim bandwidth when there are too few authors
        const maxTotalHeight = 2.0 * m.height / 3.0
        const leftoverY = (m.height - maxTotalHeight) / 2
        authorsY.range([leftoverY, m.height - leftoverY])
    }
    // x commit positioning date scale
    timeX
        .range([0, m.width - m.authorsWidth])
        .domain(d3.extent(timeExtent))
    // insertion/deletion stat scale
    const maxLineStat = lineStats.max
    const minLineStat = lineStats.min
    const percentile = lineStats.percentile_value
    stat.domain([minLineStat, percentile])
        .range([3, yBandwidth() / 2]).clamp(true)
    overflowInsertionsColor.domain([percentile, maxLineStat])
    overflowDeletionsColor.domain([percentile, maxLineStat])

    // - high level
    renderAuthors(authors)
    renderAxis()
    renderCommits(commits, (commit) => translateCommitY(commit, authors), yBandwidth)
    // renderShape(commits, authors)

    // - interaction
    setupMouseover(authors, commits, authors)
}

function renderShape(commits, authors) {
    const allTimes = commits.map(d => d.time)
    let authorCommits = authors.map(author => {
        const cts = commits.filter(c => c.email === author.email)
        return {'author': author, 'commits': cts}
    })

    for (const idx in authorCommits) {
        const obj = authorCommits[idx]

        const area = d3.area()
              .x(c => timeX(c.time))
              .y0(c => translateCommitY(c, authors) + yBandwidth()/2 + stat(c.deletions))
              .y1(c => translateCommitY(c, authors) + yBandwidth()/2 - stat(c.deletions))
        const areaPath = area(obj.commits)
        m.chart.append('path')
            .attr('d', areaPath)
            .st({fill: '#999', fillOpacity: 0.9})
    }
}

function renderCommits(commits, yTranslatorForCommit, commitHeight) {
    const commitsGSelect = m.chart.selectAll('g.commit')
          .data(commits)
    const commitsGEnter = commitsGSelect.enter()
          .append('g').attr('class', 'commit')
    const commitsG = commitsGSelect.merge(commitsGEnter)
          .translate(commit => [timeX(commit.time), yTranslatorForCommit(commit)])
    const commitWidth = 1.5
    // insertions
    commitsGEnter.append('rect.insertion')
    commitsG.selectAll('rect.insertion')
        .attr('width', commitWidth)
        .attr('height', d => stat(d.insertions))
        .attr('y', d => commitHeight() / 2 - m.ySep - stat(d.insertions))
        .style('fill', d => statColor(d, 'insertions'))
    // deletions
    commitsGEnter.append('rect.deletion')
    commitsG.selectAll('rect.deletion')
        .attr('width', commitWidth)
        .attr('height', d => stat(d.deletions))
        .attr('y', commitHeight()/2)
        .style('fill', d => statColor(d, 'deletions'))
}

export function renderAxis() {
    m.chart.append('g.timelineAxis')
        .translate([0, m.height])
        .call(axisX)
}

function renderAuthors(authors) {
    // translate to the far right, after timeX engs
    const authorsGEnter = m.chart.selectAll('g.authors').data(authors)
        .enter().append('g.authors')
    const g = m.chart.selectAll('g.authors')
    authorsGEnter.append('text.name')
        .text(function(d) {
            // store a reference to the SVG element in the data for mouseover manipulation
            d.text = this
            if (d.names) {
                return `& ${d.names.length} more authors`
            } else {
                return d.name.split(' ')[0]
            }
        })
    // these are removed on transitioning away, so we can always append to the g's
    g.append('text.commits-count')
        .text((d, i) => i === 0 ? `${d.commits.length} commits` : d.commits.length)
    m.chart.selectAll('g.authors text.commits-count')
        .at({x: 0, y: yBandwidth()-10}) // need to do it on update as well, as rhythmViz repositions this text
    m.chart.selectAll('g.authors text.name')
        .at({x: 0, y: yBandwidth()/2}) // need to do it on update as well, as rhythmViz repositions this text
    // draw the author thin line across the width of timeline
    g.selectAll('rect').data([1]).enter().append('rect')
        .at({x: -(timeX.range()[1]-timeX.range()[0]), y: yBandwidth()/2 - m.ySep/2, width: (timeX.range()[1]-timeX.range()[0]), height: 0.5})

    g.transition(m.mainTransition)
        .translate(d => [timeX.range()[1]+10, authorsY(d.email)])
}

// --- Mouseover

function setupMouseover(authors, commits) {
    // add elements for mouseover display
    m.chart.selectAll('g.mouseover').data([1]).enter().append('g.mouseover')

    // NOTE: mouseoverG is a misnomer: it is the tooltip.
    // SO not to be confused with the rect#mouseover below for tracking mouse overs
    const mouseoverG = m.chart.selectAll('g.mouseover')
    mouseoverG.append('rect.mouseover-background')
        .at({x: 10, y: 10, width: 300, height: 60})
    mouseoverG.append('text.hover-commit-message')
        .at({x: 16, y: 30})
    mouseoverG.append('text.hover-commit-insertion-deletion')
        .at({x: 16, y: 50})
    mouseoverG.append('text.hover-commit-time')
        .at({x: 16, y: 63})

    // --- helper functions --- (mouseover detection below)
    const bisect = d3.bisector(function(d, compared) {
        // order matters here
        return compared - d.time
    }).left
    const hideMessage = () => {
        mouseoverG.translate([-400, -100])
    }
    const showMessage = (commit) => {
        const x = timeX(commit.time)
        const y = translateCommitY(commit, authors) + yBandwidth()/2
        const message = `${commit.message}`
        mouseoverG.translate([x, y])
        mouseoverG.select('text.hover-commit-message')
            .text(message)
        mouseoverG.select('text.hover-commit-insertion-deletion')
            .text(`+ ${commit.insertions} - ${commit.deletions}`)
        mouseoverG.select('text.hover-commit-time')
            .text(`${timeFormat(commit.time)}`)
    }
    const hoveredOverAuthorY = (mousePos) => {
        const ifloat = Math.abs((mousePos[1])/yBandwidth())
        let i = Math.ceil(ifloat) - 1
        return Math.abs(0.5 - Math.abs(i - ifloat)) < 0.5 ? authors[i] : undefined
    }
    const closestCommitForAuthor = (author, hoveredTime, mousePos) => {
        const lowerCommitAuthors = authors[authors.length-1]
        let authorCommits
        if (lowerCommitAuthors.email === author.email && lowerCommitAuthors.isLowerCommitAuthor) {
            authorCommits = commits.filter(commit => lowerCommitAuthors.emails.indexOf(commit.email) != -1)
        } else {
            authorCommits = commits.filter(commit => commit.email === author.email)
        }
        let match = bisect(authorCommits, hoveredTime, 0, authorCommits.length)
        let best
        if (match < 0 || match >= authorCommits.length) { return undefined }
        if (match === 0) { best = 0 }
        else {
            best = Math.abs(authorCommits[match].time - hoveredTime) < Math.abs(authorCommits[match-1].time - hoveredTime) ? match : match - 1
        }
        const commit = authorCommits[best]
        const commitX = timeX(commit.time)
        if (Math.abs(commitX - mousePos[0]) > 5) {
            return undefined
        }
        return commit
    }
    // --- helper functions - end ---

    hideAuthorHover(); hideMessage() // begin by hiding

    // the mouseover background that detects hover position (also used in rhythm hover)
    m.addMouseoverRect()
        .on('mouseout', () => {
            hideMessage()
            hideAuthorHover()
        })
        .on('mousemove', function() {
            if (setup.currentCommitsViz() !== 'timeline') {return}
            const mousePos = d3.mouse(this)
            if (mouseOutOfBounds(mousePos)) {
                hideMessage()
                hideAuthorHover()
                return
            }

            // -- Get author
            const author = hoveredOverAuthorY(mousePos)
            if (!author) {
                hideMessage()
                hideAuthorHover()
                return
            }
            // -- Get time
            const hoveredTime = timeX.invert(mousePos[0])

            // -- Show commit message if next to the author
            const commit = closestCommitForAuthor(author, hoveredTime, mousePos)
            if (commit) {
                showMessage(commit)
            } else { hideMessage() }

            // -- Hover author's label
            // unhover the previously selected
            hideAuthorHover()
            // hover the current selection
            const authorG = d3.select(author.text.parentNode)
            authorG.classed('author-hover', true)
        })
}

// --- Rendering helpers

const hideAuthorHover = () => {
    d3.selectAll('g.authors.author-hover').classed('author-hover', false)
}


// --- General helpers

export function yBandwidth() {
    return authorsY.bandwidth()
}

export const emailForCommit = (commit, authors) => {
    const lowerCommitAuthors = authors[authors.length - 1]
    if (lowerCommitAuthors.emails && lowerCommitAuthors.emails.indexOf(commit.email) !== -1) {
        return lowerCommitAuthors.email
    } else {
        return commit.email
    }
}

/*
 * Since last "author" is a list of authors (those with very few commits),
 * translating using the authorsY scale needs some more work than `authorsY(commit.email)`
 */
const translateCommitY = (commit, authors) => {
    return authorsY(emailForCommit(commit, authors))
}

export function statColor(commit, key) {
    const val = commit[key]
    stat.clamp(false)
    const h = stat(val)
    stat.clamp(true)
    const hClamped = stat(val)
    if (h <= hClamped) {
        return key === 'insertions' ? overflowInsertionsColor.range()[0] : overflowDeletionsColor.range()[0]
    }
    return key === 'insertions' ?
        overflowInsertionsColor(val) + 8 : overflowDeletionsColor(val) + 9
}

export function mouseOutOfBounds(mousePos) {
    return (mousePos[0] < 0 || mousePos[0] > m.width - yBandwidth() || mousePos[1] < 0 || mousePos[1] > m.height)
}

