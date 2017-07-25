import * as d3 from 'd3'
import * as setup from './helpers/setup.js'

// -- Begin
d3.json('/repoexplorer?get_repo=true', (response) => {
    const data = response.data
    // setup.showReloadTime(response)
    setup.showViz(data)
})
