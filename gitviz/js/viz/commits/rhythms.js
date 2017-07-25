const d3 = Object.assign({},
                         require('d3-selection'), require('d3-shape'), require('d3-scale'),
                         require('d3-format'), require('d3-time-format'),
                         require('d3-axis'), require('d3-time-format'),
                         require('d3-array'), require('d3-jetpack'))
import * as timeline from './timeline.js'
import * as setup from '../../helpers/setup.js'
import * as m from '../../helpers/metrics.js'
import * as commits from '../commits/commits_setup.js'

/**
  * Also, returns the center to which the authors were transformed
  */
function transformAuthors(authorBoxSide) {
    let authorCenters = {}
    const authorGs = m.chart.selectAll('g.authors')
    authorGs
        .transition(m.mainTransition)
        .translate((d, i) => {
            const yIndex = Math.floor((authorBoxSide * i)/m.width)
            const yPos = yIndex * authorBoxSide
            const xPos = Math.floor(authorBoxSide * i - yIndex*m.width)
            const pos = [xPos, yPos]
            authorCenters[d.email] = pos
            return pos
        })
    authorGs.selectAll('text')
        .at({x: 5, y: 14})
    return authorCenters
}

function rhythmValue(commit, rhythmType) {
    return rhythmType === setup.hourOfDayType ? commit.local_day_minutes :
          rhythmType === setup.dayOfWeekType ? commit.local_weekday_minutes : 0
}

/*
 * @param authors authors info from JSON
 * @param authorCenters center of author g's so we can transform commits around it
 * @param authorBoxSide square's side of author G
 * @param rhythmType either 'hourOfDay' or 'dayOfWeek'
 */
function transformCommits(authors, authorCenters, authorBoxSide, rhythmType) {
    // Commits translation
    const maxRhythmValue = rhythmType === setup.hourOfDayType ? 1440 // for minutes in a day
          : (rhythmType === setup.dayOfWeekType ? 7*1440 : 0) // 7 weekdays
    const radial = d3.scaleLinear().domain([0, maxRhythmValue]).range([0, 360])

    const commitsG = m.chart.selectAll('g.commit')
    // -- If need to rescale the stat rects to be inside the author box.
    // --- but this makes them offset from the center
    // stat.range([3, authorBoxSide/4])
    // commitsG.selectAll('rect.insertion')
    //     .attr('height', d => stat(d.insertions))
    // commitsG.selectAll('rect.deletion')
    //     .attr('height', d => stat(d.deletions))
    commitsG
        .transition(m.mainTransition)
        .attr('transform', (commit) => {
            const value = rhythmValue(commit, rhythmType)
            const angle = radial(value)
            const rotate = `rotate(${angle})`
            const email = timeline.emailForCommit(commit, authors)
            const newPosCenter = authorCenters[email]
            const newPosCenterX = newPosCenter[0]+authorBoxSide/2
            const newPosCenterY = newPosCenter[1]+authorBoxSide/2
            const translateToAuthorG = `translate(${newPosCenterX}, ${newPosCenterY})`
            const translateInAuthor = `translate(0, ${timeline.yBandwidth()/2})`
            let res = `${translateToAuthorG}${rotate}${translateInAuthor}`
            return res
        })
}

function transformHourMarkers(d, authorBoxSide, rhythmType) {
    const translate = `translate(0, ${authorBoxSide/2-timeline.yBandwidth()/2-10})`
    let rotate = ""
    if (rhythmType === setup.hourOfDayType) {
        if (d===2) { rotate = 'rotate(-90)'}
        else if (d===3) { rotate = 'rotate(225)'}
        else if (d===4) { rotate = 'rotate(180)'}
        else if (d===5) { rotate = 'rotate(135)'}
        else if (d===6) { rotate = 'rotate(90)'}
        else if (d===0) { rotate = 'rotate(0)'}
    } else if (rhythmType === setup.dayOfWeekType) {
        if (d===0) { rotate = 'rotate(-10)'}
        else if (d===1) { rotate = 'rotate(270)'}
        else if (d===2) { rotate = 'rotate(250)'}
        else if (d===3) { rotate = 'rotate(180)'}
        else if (d===4) { rotate = 'rotate(130)'}
        else if (d===5) { rotate = 'rotate(80)'}
        else if (d===6) { rotate = 'rotate(10)'}
    }
    return `${translate}${rotate}`
}

function textForHourMarker(d, rhythmType) {
    if (rhythmType === setup.hourOfDayType) {
        if (d===2) { return '6am'}
        else if (d===3) { return '9am'}
        else if (d===4) { return 'noon'}
        else if (d===5) { return '3pm'}
        else if (d===6) { return '6pm'}
        else if (d===0) { return 'midnight'}
        return undefined
    } else if (rhythmType === setup.dayOfWeekType) {
        if (d===0) { return 'M'}
        else if (d===1) { return 'Tu'}
        else if (d===2) { return 'W'}
        else if (d===3) { return 'Th'}
        else if (d===4) { return 'F'}
        else if (d===5) { return 'Sa'}
        else if (d===6) { return 'Su'}
        return undefined
    }
}

function addHourMarkers(authorBoxSide, boxPerRow, rhythmType) {
    const innerGs = m.chart.selectAll('g.authors')
          .append('g')
          .attr('class', 'rhythmInner')
    // add marker gs and rotate them around authorsGs
    const markerCount = rhythmType === setup.hourOfDayType ? 8 : rhythmType === setup.dayOfWeekType ? 7 : 1
    const innerGsEnter = innerGs
          .selectAll('g')
          .data(d3.range(0, markerCount+1)).enter()
          .append('g')
          .attr('transform', (d, i) => {
              let angle = 360/markerCount * i
              if (rhythmType===setup.dayOfWeekType) {
                  angle += 360/(markerCount*2)
              }
              let translateInner = `translate(${authorBoxSide/2}, ${authorBoxSide/2})`
              let rotate = `rotate(${angle})`
              let translateOuter = `translate(0, ${timeline.yBandwidth()/2})`
              return `${translateInner}${rotate}${translateOuter}`
          })

    // add hour markers (disabled later by default; enabled on hover)
    innerGsEnter
        .append('text.rhythmHour')
        .attr('transform', d => transformHourMarkers(d, authorBoxSide, rhythmType))
        .text(d => textForHourMarker(d, rhythmType))

    function resetHover() {
        m.chart.selectAll('.rhythmInner')
            .classed('rhythmHourHover', false)
        m.chart.selectAll('.rhythmInner')
            .filter((d, i) => i === 0)
            .classed('rhythmHourHover', true)
    }

    m.chart.selectAll('rect#mouseover')
        .on('mousemove', function() {
            const currentViz = commits.currentCommitsViz()
            if(currentViz !== 'rhythm-hour' && currentViz !==  'rhythm-week') { return }
            const mousePos = d3.mouse(this)
            if (timeline.mouseOutOfBounds(mousePos)) {
                return
            }
            const row = Math.floor(mousePos[1]*1.0/authorBoxSide)
            const col = Math.floor(mousePos[0]*1.0/authorBoxSide)
            const idx = row * boxPerRow + col
            if (idx > m.chart.selectAll('g.authors').size()) { return }
            const allGs = m.chart.selectAll('.rhythmInner')
            const match = allGs.filter((d, i) => {
                return i === idx
            })
            allGs.call(sel => {
                sel.classed('rhythmHourHover', false)
            })
            match.classed('rhythmHourHover', true)
        })
        .on('mouseout', resetHover)

    resetHover()
    //m.chart.selectAll('g.authors').append('rect')
         //.at({width: authorBoxSide-4, height: authorBoxSide-4})
         //.st({fill: '#666', fillOpacity: 0.1})
}

export function renderRhythms(commits, authors, timeExtent, lineStats, rhythmType) {
    const lowCEmail = authors[authors.length-1]
    // Authors translation
    const innerRadius = 30
    let boxPerRow = 7
    let authorBoxSide = m.width/boxPerRow
    if (authorBoxSide < timeline.yBandwidth()+innerRadius) {
        authorBoxSide = timeline.yBandwidth()*2+innerRadius
        boxPerRow = Math.ceil(m.width/authorBoxSide)
    }

    const numRows = Math.ceil(authors.length/boxPerRow)
    const lastRowCount = boxPerRow - (numRows*boxPerRow - authors.length)
    if (lastRowCount < boxPerRow) {
        // TODO-later should center the items in this case, for the last row
    }

    // transform authors & commits
    const authorCenters = transformAuthors(authorBoxSide)
    transformCommits(authors, authorCenters, authorBoxSide, rhythmType)

    addHourMarkers(authorBoxSide, boxPerRow, rhythmType)
}

export function transitionFromRhythm() {
    m.chart.selectAll('g.rhythmInner').remove()
    m.chart.selectAll('g.authors rect').remove()
}
