export default [
  {
    selector: 'node',
    style: {
      'width': 'data(rank)' as any,
      'height': 'data(rank)' as any,
      'background-image': 'data(img)',
      'background-fit': 'contain',
      // 'font-size': '18px',
      // 'font-weight': 'bold' as any,
      // 'content': `data(name)`,
      // 'text-valign': 'center' as any,
      // 'text-wrap': 'wrap' as any,
      // 'text-max-width': '140px',
      // 'background-color': 'gray',
    }
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': '5px',
      'border-color': 'blue',
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
      'width': '1px',
      'line-color': 'gray',
    }
  },
  {
    selector: 'edge.mutual',
    style: {
      'width': '5px',
      'line-color': 'black',
    }
  },
  {
    selector: 'node.parent',
    style: {
      'label': 'data(name)',
      'font-size': '20px',
      'font-weight': 'bold' as any,
      'text-valign': 'top' as any,
      'text-halign': 'center' as any,
      'background-color': '#e0e0e0',
      'border-width': '2px',
      'border-color': '#c0c0c0',
      'shape': 'round-rectangle' as any,
      'padding': '10px'
    }
  }
]
