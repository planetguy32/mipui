class SightGesture extends Gesture {
  constructor() {
    super();
    this.hoveredCell_ = null;
    this.cellsInSight_ = [];
  }
  startHover(cell) {
    if (!cell || cell.role != 'primary') return;
    this.hoveredCell_ = cell;
    const origins = [{
      x: cell.offsetLeft + cell.width / 2,
      y: cell.offsetTop + cell.height / 2,
      sectors: [{top: -1, bottom: 1}],
    }];
    this.cellsInSight_ =
        [cell].concat(this.calculateCellsInSight_(cell, origins));
    this.cellsInSight_.forEach(cellInSight => {
      cellInSight.showHighlight(ct.overlay, {
        [ck.kind]: ct.overlay.hidden.id,
        [ck.variation]: ct.overlay.hidden.black.id,
      });
    });
  }
  stopHover() {
    this.cellsInSight_.forEach(cellInSight => {
      cellInSight.hideHighlight(ct.overlay);
    });
    this.hoveredCell_ = null;
    this.cellsInSight_ = [];
  }
  startGesture() {}
  continueGesture(cell) {}
  stopGesture() {}

  getColumnCells_(column) {
    const result = [];
    // Initial naive implementation.
    const firstRow = parseInt(state.getProperty(pk.firstRow)) - 0.5;
    const lastRow = parseInt(state.getProperty(pk.lastRow)) + 0.5;
    for (let row = firstRow; row <= lastRow; row += 0.5) {
      row = Math.round(row * 2) / 2;
      const cell = state.theMap.getCell(row, column);
      if (cell) result.push(cell);
    }
    return result;
  }

  isOpaque_(cell) {
    return cell.hasLayerContent(ct.walls);
  }

  cleanSectors_(sectors) {
    if (!sectors) return [];
    return sectors.filter(sector => sector.top < sector.bottom);
  }

  calculateCellsInSight_(originCell, originPoints) {
    const cellsInSight = [];
    const maxColumn = parseInt(state.getProperty(pk.lastColumn)) + 0.5;
    for (let column = originCell.column; column <= maxColumn; column += 0.5) {
      column = Math.round(column * 2) / 2;
      const columnCells = this.getColumnCells_(column);
      if (columnCells.length == 0) break;
      const columnLeft = columnCells[0].offsetLeft;
      const columnRight = columnLeft + columnCells[0].width;
      columnCells.forEach(columnCell => {
        const cellIsBeforeOrigin = columnCell.row <= originCell.row;
        const cellTop = columnCell.offsetTop;
        const cellBottom = columnCell.offsetTop + columnCell.height;
        originPoints.forEach(originPoint => {
          const distanceToTop = cellTop - originPoint.y;
          const distanceToBottom = cellBottom - originPoint.y;
          const distanceToLeft = columnLeft - originPoint.x;
          const distanceToRight = columnRight - originPoint.x;
          const cellTopFromScanDirection =
              distanceToTop /
              (cellIsBeforeOrigin ? distanceToLeft : distanceToRight);
          const cellBottomFromScanDirection =
              distanceToBottom /
              (cellIsBeforeOrigin ? distanceToLeft : distanceToRight);
          const cellTopFromAntiScanDirection =
              distanceToTop /
              (cellIsBeforeOrigin ? distanceToRight : distanceToLeft);
          const cellBottomFromAntiScanDirection =
              distanceToBottom /
              (cellIsBeforeOrigin ? distanceToRight : distanceToLeft);
          originPoint.sectors.forEach((sector, sectorIndex) => {
            if (!originPoint.nextSectors) {
              originPoint.nextSectors =
                  originPoint.sectors.map(currentSector => ({
                    top: currentSector.top,
                    bottom: currentSector.bottom,
                  }));
              originPoint.additionalNextSectorsCount = 0;
            }
            const actualSectorIndex =
                sectorIndex + originPoint.additionalNextSectorsCount;
            let nextSector = originPoint.nextSectors[actualSectorIndex];
            if (sector.top < cellBottomFromAntiScanDirection &&
                sector.bottom > cellTopFromScanDirection) {
              cellsInSight.push(columnCell);
              const currentCellIsOpaque = this.isOpaque_(columnCell);
              if (currentCellIsOpaque && !sector.prevColCellWasOpaque) {
                nextSector.bottom = cellTopFromScanDirection;
              } else if (!currentCellIsOpaque && sector.prevColCellWasOpaque) {
                nextSector = {
                  top: cellBottomFromAntiScanDirection,
                  bottom: sector.bottom,
                };
                originPoint.nextSectors
                    .splice(actualSectorIndex + 1, 0, nextSector);
                originPoint.additionalNextSectorsCount++;
              }
              sector.prevColCellWasOpaque = currentCellIsOpaque;
            }
          }); // Sectors of origin point loop
        }); // Origin point loop
      }); // Cells in column loop
      originPoints.forEach(originPoint => {
        originPoint.sectors = this.cleanSectors_(originPoint.nextSectors);
        originPoint.nextSectors = null;
        originPoint.additionalNextSectorsCount = 0;
      });
      originPoints =
          originPoints.filter(originPoint => originPoint.sectors.length > 0);
      if (originPoints.length == 0) break;
    } // Column loop
    return cellsInSight;
  }
}
