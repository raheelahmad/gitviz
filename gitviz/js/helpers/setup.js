const d3 = Object.assign({},
                         require('d3-selection'), require('d3-shape'), require('d3-scale'),
                         require('d3-format'), require('d3-time-format'),
                         require('d3-axis'), require('d3-time-format'),
                         require('d3-array'), require('d3-jetpack'))
import * as commits from '../viz/commits/commits_setup.js'
import * as files from '../viz/files/files_setup.js'

export let hourOfDayType = 'hourOfDay'
export let dayOfWeekType = 'dayOfWeek'

export function showViz(data) {
    setupVizNav(data)

    // show commits viz by default
    commits.setupCommitsViz(data)
    commits.renderCommitsViz(data)
}

export function showReloadTime(response) {
    const source = response.source
    let cachedTime
    if (source === 'cache') {
        cachedTime = new Date(response['cached_time'])
        const reloadDiv = d3.select('body').select('div#reload').style('display', 'none')
        reloadDiv.style('display', 'block')
        reloadDiv.select('span').text(`Loaded from cache (stored on ${cachedTime.toDateString('en-US')})`)
    }
}

function currentViz() {
    return d3.select('#selected-viz')
        .select('a').attr('name')
}

function setupVizNav(data) {
    d3.selectAll('#top-nav a')
        .on('click', function() {
            const previousSelection = d3.select('#selected-viz')
            const selected = d3.select(this.parentNode)
            const previous = previousSelection.select('a').attr('name')
            const selection = selected.select('a').attr('name')
            if (previous === selection) {return}

            previousSelection.at({id: 'none'})
            selected.at({id: 'selected-viz'})

            if (selection === 'commits') {
                if (previous === 'files') {
                    files.transitionFromFilesViz()
                }
                commits.renderCommitsViz(data)
            } else if (selection === 'files') {
                if (previous === 'commits') {
                    commits.transitionFromCommitsViz()
                }
                files.renderFilesViz(data)
            }
        })
}

