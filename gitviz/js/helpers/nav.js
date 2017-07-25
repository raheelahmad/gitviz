var d3 = Object.assign({}, require('d3-selection'), require('d3-shape'), require('d3-drag'), require('d3-array'), require('d3-jetpack'))

export class SubNavItem {
    constructor(name, text, description, to, from) {
        this.name = name
        this.text = text
        this.description = description
        this.to = to
        this.from = from
    }
}

export class SubNav {
    constructor(items) {
        let name = 'sub-nav'
        let selectedId = 'selected-view'
        this.name = name
        this.selectedId = selectedId
        this.items = items

        this.setupSwitching = () => {
            const nameId = `#${this.name} a`
            d3.selectAll(nameId)
                .on('click', function() {
                    const previousId = `#${selectedId}`
                    const previousSelection = d3.select(previousId)
                    const selected = d3.select(this.parentNode)
                    const previous = previousSelection.select('a').attr('name')
                    const selection = selected.select('a').attr('name')
                    if (previous === selection) {return}

                    previousSelection.at({id: 'none'})
                    selected.at({id: selectedId})

                    const toSubNav = items.filter(d => d.name === selection)[0]
                    const fromSubNav = items.filter(d => d.name === previous)[0]
                    fromSubNav.from()
                    toSubNav.to()

                    const selectionDescription = d3.select('text.selectedDescription')
                    selectionDescription.text(`→ ${toSubNav.description}`)
                })
        }
    }
}

// --- Add/remove the sub-nav from the DOM

export function removeSubNav(nav) {
    d3.select('body').selectAll(`#${nav.name}`)
        .remove()
}

export function addSubNav(nav) {
    const controls = d3.selectAll('#controls')
    const subNavDiv = `div#${nav.name}`
    const navUL = controls.append(subNavDiv)
          .append('ul')
    for (var idx in d3.range(0, nav.items.length)) {
        const item = nav.items[idx]
        // first element is selected initially
        const li = idx == 0 ? `li#${nav.selectedId}` : 'li'
        navUL.append(li).append('a')
            .at({href: '#', name: item.name}).text(item.text)
    }

    // first element is selected initially
    const selectedSubNavDescription = nav.items[0].description
    d3.select(subNavDiv).append('text.selectedDescription')
        .text(`→ ${selectedSubNavDescription}`)
    nav.setupSwitching()
}

