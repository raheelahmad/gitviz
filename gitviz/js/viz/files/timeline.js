const d3 = Object.assign({},
                         require('d3-selection'), require('d3-shape'), require('d3-scale'),
                         require('d3-format'), require('d3-time-format'),
                         require('d3-axis'), require('d3-time-format'), require('d3-transition'),
                         require('d3-array'), require('d3-jetpack'))
const R = require('ramda')
import * as m from '../../helpers/metrics.js'
import { timeX, renderAxis } from '../commits/timeline.js'

const filesY = d3.scaleBand().rangeRound([0, m.height])
const topAuthorX = d3.scaleBand().rangeRound([0, m.width])
const stat = d3.scaleLinear()
const overflowInsertionsColor = d3.scaleLinear().range(['#AAAADD', '#020233'])
const overflowDeletionsColor = d3.scaleLinear().range(['#DDAAAA', '#330202'])

export function render(data, allCommits, lineStats) {
    const files = data.map(d => d.file)
    const allFileCommitInfos = data.reduce((accum, fileInfo) => accum.concat(fileInfo.commits), [])
    // associate the commit
    for (var i = 0; i < allFileCommitInfos.length; i++) {
        const info = allFileCommitInfos[i]
        info.commit = allCommits[info.commit_index]
    }

    let authorsSet = []
    data.forEach((fileInfo) => {
        // add top 5 authors of this file to the set
        const topAuthors = fileInfo.authors.slice(0, 5)
        topAuthors.forEach((author) => {
            if (!R.contains(author, authorsSet)) {
                authorsSet.push(author)
            }
        })
    })

    // choosing a smaller set of authors, and setting
    // author domain will happen in renderTopAuthors
    const topAuthors = Array.from(authorsSet)

    filesY.domain(files)

    // insertion/deletion stat scale
    const maxLineStat = lineStats.max
    const minLineStat = lineStats.min
    const percentile = lineStats.percentile_value
    stat.domain([minLineStat, percentile])
        .range([3, yBandwidth() / 2]).clamp(true)
    overflowInsertionsColor.domain([percentile, maxLineStat])
    overflowDeletionsColor.domain([percentile, maxLineStat])

    renderCommits(allFileCommitInfos, (commit) => filesY(commit.file), yBandwidth)
    renderFiles(data)
    renderAxis()
    renderTopAuthors(topAuthors)
    setupMouseOver(topAuthors, data)
}

function renderFiles(data) {
    // translate to the far right, after timeX engs
    const authorsGEnter = m.chart.selectAll('g.files').data(data, d => d.file)
        .enter().append('g.files')
    const g = m.chart.selectAll('g.files')
    authorsGEnter.append('text.name')
        .text(d => d.file)
    // these are removed on transitioning away, so we can always append to the g's
    g.append('text.commits-count')
        .text((d, i) => i === 0 ? `${d.commits.length} commits` : d.commits.length)
    m.chart.selectAll('g.files text.commits-count')
        .at({ x: 0, y: yBandwidth() - 15 })
    m.chart.selectAll('g.files text.name')
        .at({ x: 0, y: yBandwidth() / 2 })
    // draw the file thin line across the width of timeline
    g.selectAll('rect').data([1]).enter().append('rect')
        .at({ x: -(timeX.range()[1] - timeX.range()[0]), y: yBandwidth() / 2 - m.ySep / 2, width: (timeX.range()[1] - timeX.range()[0]), height: 0.5 })

    g.transition(m.mainTransition)
        .translate(d => [timeX.range()[1] + 10, filesY(d.file)])
}

function renderCommits(commits, yTranslatorForCommit, commitHeight) {
    const commitsGSelect = m.chart.selectAll('g.commit')
          .data(commits)
    const commitsGEnter = commitsGSelect.enter()
          .append('g').attr('class', 'commit')
    const commitsG = commitsGSelect.merge(commitsGEnter)
          .translate(d => [timeX(d.commit.time), yTranslatorForCommit(d)])
    const commitWidth = 1.5
    // insertions
    commitsGEnter.append('rect.insertion')
    commitsG.selectAll('rect.insertion')
        .attr('width', commitWidth)
        .attr('height', d => d.insertions ? stat(d.insertions) : 0)
        .attr('y', d => d.insertions ? commitHeight() / 2 - m.ySep - stat(d.insertions) : 0)
        .style('fill', d => statColor(d, 'insertions'))
    // deletions
    commitsGEnter.append('rect.deletion')
    commitsG.selectAll('rect.deletion')
        .attr('width', commitWidth)
        .attr('height', d => d.deletions ? stat(d.deletions) : 0)
        .attr('y', d => d.deletions ? commitHeight() / 2 : 0)
        .style('fill', d => statColor(d, 'deletions'))
}

function renderTopAuthors(authors) {
    const topAuthors = authors.slice(0, 10)
    topAuthorX.domain(topAuthors.map(d => d.name))
    const topAuthorsG = m.chart.selectAll('g.top-authors')
          .data(topAuthors, d => d.name)

    topAuthorsG.exit()
        .remove()

    const topAuthorsGEnter = topAuthorsG
        .enter().append('g.top-authors')
    topAuthorsGEnter.append('text')

    m.chart.selectAll('g.top-authors')
        .translate(d => [topAuthorX(d.name) + topAuthorX.bandwidth() / 2, -20])
        .selectAll('text')
        .text(d => d.name)
}

function setupMouseOver(topAuthors, data) {
    const allCommits = m.chart.selectAll('g.commit')
    const allFiles = m.chart.selectAll('g.files')
    const estimatedAuthorHeight = 20
    let currentFileData
    let currentAuthors

    // Moves the authors header either to just above fileData (horizontal timeline of a file)
    // Or to the top
    function moveAuthors(fileData) {
        const authors = fileData ? fileData.authors : topAuthors
        currentAuthors = authors
        renderTopAuthors(authors)

        if (fileData) {
            let y = filesY(fileData.file)
            m.chart.selectAll('g.top-authors')
                .translate(d => [topAuthorX(d.name) + topAuthorX.bandwidth() / 2, y])
        }
    }

    // if an author is hovered over, filter the commits for them.
    // If currently hovering over a file, filter that file's commits for this author
    function mainAuthorsHover(mousePos) {
        const topAuthorsG = m.chart.selectAll('g.top-authors')
        const authorIndexF = Math.abs((mousePos[0] / topAuthorX.bandwidth()))
        const authorIndex = Math.ceil(authorIndexF) - 1
        const authorOutOfRange = authorIndex < 0 || authorIndex >= topAuthors.length
        const maxY = currentFileData ? filesY(currentFileData.file) : 0
        const yOutOfRange = mousePos[1] > maxY
        if (authorOutOfRange || yOutOfRange) {
            topAuthorsG.classed('hide', false)
            allCommits.filter(d => d.file === currentFileData.file).classed('hide', false)
            return
        }
        const author = currentAuthors[authorIndex]
        allCommits.filter(d => {
            const noAuthorMatch = d.commit.name !== author.name
            if (currentFileData) {
                const noFileMatch = d.file !== currentFileData.file
                return noAuthorMatch || noFileMatch
            } else {
                return noAuthorMatch
            }
        })
            .classed('hide', true)
        allCommits.filter(d => {
            const authorMatch = d.commit.name === author.name
            if (currentFileData) {
                const fileMatch = d.file === currentFileData.file
                return authorMatch && fileMatch
            } else {
                return authorMatch
            }
        })
            .classed('hide', false)
        topAuthorsG.filter(d => d.name === author.name)
            .classed('hide', false)
        topAuthorsG.filter(d => d.name !== author.name)
            .classed('hide', true)
    }

    function filesHover(mousePos) {
        function unhide() {
            allCommits.classed('hide', false)
            allFiles.classed('hide', false)
            currentFileData = null
            moveAuthors(null)
        }
        if (mousePos[1] < 0) {
            unhide()
            return
        }
        const ifloat = Math.abs((mousePos[1]) / filesY.bandwidth())
        let i = Math.ceil(ifloat) - 1
        const fileData = data[i]
        if (!fileData) {
            unhide()
            return
        }
        if (currentFileData === fileData) {
            return
        }
        if (currentFileData) {
            const currentFileY = filesY(currentFileData.file)
            const minYForCurrentFile = currentFileY - estimatedAuthorHeight
            const inAuthorsRange = mousePos[1] > minYForCurrentFile && mousePos[1] < currentFileY + filesY.bandwidth()
            if (inAuthorsRange) {
                return
            }
        }
        currentFileData = fileData

        moveAuthors(fileData)

        allFiles.filter(d => d.file === fileData.file)
            .classed('hide', false)
        allFiles.filter(d => d.file !== fileData.file)
            .classed('hide', true)

        allCommits.filter(d => d.file === fileData.file)
            .classed('hide', false)
        allCommits.filter(d => d.file !== fileData.file)
            .classed('hide', true)
    }

    function mouseMoved(mousePos) {
        filesHover(mousePos)
        mainAuthorsHover(mousePos)
    }
    m.addMouseoverRect(-40)
        .on('mouseout', function() {
            const mousePos = d3.mouse(this)
            const mousePosY = mousePos[1]
            if (mousePosY > 0 && mousePosY < m.height) {
                // don't reset if we are mouseouting in between files
                mouseMoved(mousePos)
                return
            }

            // Reset
            const topAuthorsG = m.chart.selectAll('g.top-authors')
            allCommits.classed('hide', false)
            topAuthorsG.classed('hide', false)
            moveAuthors() // move authors back to top
        })
        .on('mousemove', function() {
            const mousePos = d3.mouse(this)
            mouseMoved(mousePos)
        })
}

function yBandwidth() {
    return filesY.bandwidth()
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
