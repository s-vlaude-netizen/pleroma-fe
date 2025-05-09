const checkCanvasExtractPermission = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#0f161e';
  ctx.fillRect(0, 0, 1, 1);

  const { data } = ctx.getImageData(0, 0, 1, 1);

  return data.join(',') === '15,22,30,255';
};

const createFaviconService = () => {
  const favicons = []
  const faviconWidth = 128
  const faviconHeight = 128
  const badgeRadius = 32
  const gapWidth = 24

  const initFaviconService = () => {
    if (!checkCanvasExtractPermission()) return;

    const nodes = document.querySelectorAll('link[rel="icon"]')
    nodes.forEach(favicon => {
      if (favicon) {
        const favcanvas = document.createElement('canvas')
        favcanvas.width = faviconWidth
        favcanvas.height = faviconHeight
        const favimg = new Image()
        favimg.crossOrigin = 'anonymous'
        favimg.src = favicon.href
        const favcontext = favcanvas.getContext('2d')
        favicons.push({ favcanvas, favimg, favcontext, favicon })
      }
    })
  }

  const isImageLoaded = (img) => img.complete && img.naturalHeight !== 0

  const clearFaviconBadge = () => {
    if (favicons.length === 0) return
    favicons.forEach(({ favimg, favcanvas, favcontext, favicon }) => {
      if (!favimg || !favcontext || !favicon) return

      favcontext.clearRect(0, 0, faviconWidth, faviconHeight)
      if (isImageLoaded(favimg)) {
        favcontext.drawImage(favimg, 0, 0, favimg.width, favimg.height, 0, 0, faviconWidth, faviconHeight)
      }
      favicon.href = favcanvas.toDataURL('image/png')
    })
  }

  const drawFaviconBadge = () => {
    if (favicons.length === 0) return
    clearFaviconBadge()
    favicons.forEach(({ favimg, favcanvas, favcontext, favicon }) => {
      if (!favimg || !favcontext || !favcontext) return

      const style = getComputedStyle(document.body)
      const badgeColor = `${style.getPropertyValue('--badgeNotification') || 'rgb(240, 100, 100)'}`

      if (isImageLoaded(favimg)) {
        favcontext.drawImage(favimg, 0, 0, favimg.width, favimg.height, 0, 0, faviconWidth, faviconHeight)
      }

      // draw bigger transparent circle to create gap
      favcontext.globalCompositeOperation = 'destination-out'
      favcontext.beginPath()
      favcontext.arc(faviconWidth - badgeRadius, badgeRadius, badgeRadius + gapWidth, 0, 2 * Math.PI, false)
      favcontext.fill()

      favcontext.globalCompositeOperation = 'source-over'
      favcontext.fillStyle = badgeColor
      favcontext.beginPath()
      favcontext.arc(faviconWidth - badgeRadius, badgeRadius, badgeRadius, 0, 2 * Math.PI, false)
      favcontext.fill()
      favicon.href = favcanvas.toDataURL('image/png')
    })
  }

  return {
    initFaviconService,
    clearFaviconBadge,
    drawFaviconBadge
  }
}

const FaviconService = createFaviconService()

export default FaviconService
