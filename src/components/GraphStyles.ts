export default [
  {
    selector: 'node',
    style: {
      'width': 'data(rank)' as any,
      'height': 'data(rank)' as any,
      'background-image': 'data(img)',
      'background-fit': 'contain',
      'font-size': '18px',
      'font-weight': 'bold' as any,
      'content': `data(name)`,
      'text-valign': 'center' as any,
      'text-wrap': 'wrap' as any,
      'text-max-width': '140px',
      'background-color': 'gray',
    }
  },
  {
    selector: 'node:selected',
    style: {
      'background-color': 'darkred',
      'color': 'white',
      'border-color': 'darkred',
      'line-color': '#0e76ba',
      'target-arrow-color': '#0e76ba'
    }
  },
  {
    selector: 'node.todirect',
    style: {
      'background-color': 'lightblue',
    }
  },
  {
    selector: 'edge',
    style: {
      'curve-style': 'straight',
      'color': 'darkred',
      'text-background-color': '#ffffff',
      'text-background-opacity': '1' as any,
      'text-background-padding': '3px',
      'width': '1px',
      'target-arrow-shape': 'triangle',
      'line-color': 'darkred',
      'target-arrow-color': 'darkred',
      'font-weight': 'bold' as any
    }
  },
]
