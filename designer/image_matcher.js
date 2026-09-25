// image_matcher.js - Professional Template Matching Engine with Background Masking & 1:1 Pixel Precision

export class ImageMatcher {
  /**
   * Load data URL or Image URL into HTMLImageElement
   */
  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('无法加载图片资源: ' + err));
      img.src = src;
    });
  }

  /**
   * Crop a portion of an image and return as PNG data URL
   */
  static async cropImage(sourceDataUrl, rect = {}) {
    const img = await this.loadImage(sourceDataUrl);
    const canvas = document.createElement('canvas');
    const rx = Math.max(0, Math.round(Number(rect.x ?? rect.x1 ?? 0)));
    const ry = Math.max(0, Math.round(Number(rect.y ?? rect.y1 ?? 0)));
    const rw = Math.max(1, Math.round(Number(rect.width) || (Number(rect.x2) - rx) || img.width));
    const rh = Math.max(1, Math.round(Number(rect.height) || (Number(rect.y2) - ry) || img.height));

    canvas.width = rw;
    canvas.height = rh;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, rx, ry, rw, rh, 0, 0, rw, rh);
    return canvas.toDataURL('image/png');
  }

  /**
   * High-Precision Template Matcher (Desktop RPA / 按键精灵 style)
   * @param {string} screenshotDataUrl - Target full screenshot (physical resolution)
   * @param {string} templateDataUrl - Snipped template image
   * @param {Object} options - Search options { region: {x1, y1, x2, y2}, minSimilarity: 60, dpr: 1, metrics: {...} }
   */
  static async match(screenshotDataUrl, templateDataUrl, options = {}) {
    const startTime = performance.now();

    let screenImg = null;
    let tplImgRaw = null;
    let roiCanvas = null;
    let rawTplCanvas = null;
    const dynamicCanvases = [];

    try {
      [screenImg, tplImgRaw] = await Promise.all([
        this.loadImage(screenshotDataUrl),
        this.loadImage(templateDataUrl)
      ]);

      if (tplImgRaw.width === 0 || tplImgRaw.height === 0) {
        throw new Error('待查找的模板图尺寸无效');
      }

      const screenW = screenImg.width;
      const screenH = screenImg.height;

      // Resolve true DPR accurately
      const dpr = (options.metrics?.innerWidth && screenW)
        ? (screenW / options.metrics.innerWidth)
        : (Number(options.dpr) > 0 ? Number(options.dpr) : 1);

      // Search ROI in physical screenshot pixels
      let region = options.region || {};
      let rx1 = Math.max(0, Math.min(screenW - 1, Math.round((Number(region.x1) || 0) * dpr)));
      let ry1 = Math.max(0, Math.min(screenH - 1, Math.round((Number(region.y1) || 0) * dpr)));
      let rx2 = Math.max(rx1 + 10, Math.min(screenW, Math.round((Number(region.x2) || (screenW / dpr)) * dpr)));
      let ry2 = Math.max(ry1 + 10, Math.min(screenH, Math.round((Number(region.y2) || (screenH / dpr)) * dpr)));

      if (rx2 <= rx1) rx2 = screenW;
      if (ry2 <= ry1) ry2 = screenH;

      const roiW = rx2 - rx1;
      const roiH = ry2 - ry1;

      // Extract ROI RGBA Buffer
      roiCanvas = document.createElement('canvas');
      roiCanvas.width = roiW;
      roiCanvas.height = roiH;
      const roiCtx = roiCanvas.getContext('2d');
      roiCtx.drawImage(screenImg, rx1, ry1, roiW, roiH, 0, 0, roiW, roiH);
      const roiData = roiCtx.getImageData(0, 0, roiW, roiH).data;

      // Extract Raw Template RGBA Buffer
      const tplW = tplImgRaw.width;
      const tplH = tplImgRaw.height;
      rawTplCanvas = document.createElement('canvas');
      rawTplCanvas.width = tplW;
      rawTplCanvas.height = tplH;
      const rawTplCtx = rawTplCanvas.getContext('2d');
      rawTplCtx.drawImage(tplImgRaw, 0, 0);
      const rawTplData = rawTplCtx.getImageData(0, 0, tplW, tplH).data;

      const minThreshold = Number(options.minSimilarity) || 60;

      // Analyze template: background detection, foreground feature segmentation & sparse keypoint probes
      const tplAnalysis = this._analyzeTemplate(rawTplData, tplW, tplH);

      // Scaling strategy: 1:1 first, then fallback to minor scales
      const scalesToTry = [1.0, 1.1, 0.9, 1.25, 0.8];
      let overallBest = {
        found: false,
        score: -1,
        similarityPct: 0,
        x: 0,
        y: 0,
        width: tplW,
        height: tplH,
        centerX: 0,
        centerY: 0
      };

      for (const scale of scalesToTry) {
        const curTplW = Math.max(4, Math.round(tplW * scale));
        const curTplH = Math.max(4, Math.round(tplH * scale));

        if (curTplW > roiW || curTplH > roiH) continue;

        let curTplData = rawTplData;
        let curTplAnalysis = tplAnalysis;

        if (scale !== 1.0) {
          const curCanvas = document.createElement('canvas');
          curCanvas.width = curTplW;
          curCanvas.height = curTplH;
          dynamicCanvases.push(curCanvas);
          const curCtx = curCanvas.getContext('2d');
          curCtx.drawImage(tplImgRaw, 0, 0, curTplW, curTplH);
          curTplData = curCtx.getImageData(0, 0, curTplW, curTplH).data;
          curTplAnalysis = this._analyzeTemplate(curTplData, curTplW, curTplH);
        }

        const matchRes = await this._matchSingleScale(roiData, roiW, roiH, curTplData, curTplW, curTplH, curTplAnalysis, minThreshold);
        const effectiveScore = scale === 1.0 ? matchRes.score : matchRes.score * 0.95;

        if (effectiveScore > overallBest.score) {
          const physX = rx1 + matchRes.x;
          const physY = ry1 + matchRes.y;
          const physW = curTplW;
          const physH = curTplH;
          const physCenterX = rx1 + Math.round(matchRes.x + curTplW / 2);
          const physCenterY = ry1 + Math.round(matchRes.y + curTplH / 2);

          overallBest = {
            found: effectiveScore * 100 >= minThreshold,
            score: effectiveScore,
            similarityPct: Math.round(effectiveScore * 100),
            x: Math.round(physX / dpr),
            y: Math.round(physY / dpr),
            width: Math.round(physW / dpr),
            height: Math.round(physH / dpr),
            centerX: Math.round(physCenterX / dpr),
            centerY: Math.round(physCenterY / dpr),
            physX,
            physY,
            physW,
            physH,
            dpr,
            scale
          };

          if (scale === 1.0 && overallBest.found) {
            break;
          }
        }
      }

      const costMs = Math.round(performance.now() - startTime);
      overallBest.costMs = costMs;
      overallBest.threshold = minThreshold;

      return overallBest;
    } finally {
      // Explicitly free canvas textures & decoded image buffers to prevent memory leaks in long loops
      if (roiCanvas) { roiCanvas.width = 0; roiCanvas.height = 0; }
      if (rawTplCanvas) { rawTplCanvas.width = 0; rawTplCanvas.height = 0; }
      for (const dc of dynamicCanvases) { dc.width = 0; dc.height = 0; }
      if (screenImg) { screenImg.src = ''; }
      if (tplImgRaw) { tplImgRaw.src = ''; }
    }
  }

  /**
   * Analyze template image to detect uniform background, foreground features, and keypoint probes
   */
  static _analyzeTemplate(tplData, tplW, tplH) {
    const corners = [
      0, // top-left
      (tplW - 1) * 4, // top-right
      ((tplH - 1) * tplW) * 4, // bottom-left
      ((tplH - 1) * tplW + (tplW - 1)) * 4 // bottom-right
    ];

    let bgR = 0, bgG = 0, bgB = 0;
    for (const c of corners) {
      bgR += tplData[c];
      bgG += tplData[c + 1];
      bgB += tplData[c + 2];
    }
    bgR /= 4;
    bgG /= 4;
    bgB /= 4;

    let hasUniformBg = true;
    for (const c of corners) {
      const d = Math.abs(tplData[c] - bgR) + Math.abs(tplData[c + 1] - bgG) + Math.abs(tplData[c + 2] - bgB);
      if (d > 35) {
        hasUniformBg = false;
        break;
      }
    }

    const isFg = new Uint8Array(tplW * tplH);
    let fgCount = 0;
    const n = tplW * tplH;

    for (let i = 0; i < n; i++) {
      const idx = i * 4;
      if (tplData[idx + 3] < 32) continue; // transparent

      if (hasUniformBg) {
        const d = Math.abs(tplData[idx] - bgR) + Math.abs(tplData[idx + 1] - bgG) + Math.abs(tplData[idx + 2] - bgB);
        if (d > 25) {
          isFg[i] = 1;
          fgCount++;
        }
      } else {
        isFg[i] = 1;
        fgCount++;
      }
    }

    // Extract sparse representative keypoint probes for ultra-fast candidate rejection
    const keyPoints = [];
    const stepX = Math.max(2, Math.floor(tplW / 4));
    const stepY = Math.max(2, Math.floor(tplH / 4));
    for (let ky = Math.floor(stepY / 2); ky < tplH; ky += stepY) {
      for (let kx = Math.floor(stepX / 2); kx < tplW; kx += stepX) {
        const kPos = ky * tplW + kx;
        const kIdx = kPos * 4;
        if (tplData[kIdx + 3] >= 64) {
          keyPoints.push({
            tx: kx,
            ty: ky,
            r: tplData[kIdx],
            g: tplData[kIdx + 1],
            b: tplData[kIdx + 2],
            isFg: isFg[kPos] === 1
          });
        }
      }
    }
    // Check foreground features first
    keyPoints.sort((a, b) => (b.isFg ? 1 : 0) - (a.isFg ? 1 : 0));

    return {
      hasUniformBg,
      bgR,
      bgG,
      bgB,
      isFg,
      fgCount,
      keyPoints
    };
  }

  /**
   * Ultra-fast single scale match with keypoint probe rejection, early exit pruning, and event loop yielding
   */
  static async _matchSingleScale(roiData, roiW, roiH, tplData, tplW, tplH, analysis, minThreshold = 60) {
    const { hasUniformBg, isFg, fgCount, keyPoints = [] } = analysis;
    const isSmallIcon = tplW <= 80 || tplH <= 80;
    const searchStep = isSmallIcon ? 1 : 2;
    const sampleStep = isSmallIcon ? 1 : 2;

    const fgWeight = (hasUniformBg && fgCount > 5) ? 3.5 : 1.0;
    const bgWeight = 1.0;

    const maxSearchX = roiW - tplW;
    const maxSearchY = roiH - tplH;

    let bestScore = -1;
    let bestX = 0;
    let bestY = 0;

    const minAcceptableScore = (minThreshold / 100) * 0.85;
    const kpLen = keyPoints.length;
    let lastYieldTime = performance.now();

    for (let y = 0; y <= maxSearchY; y += searchStep) {
      // Yield to JS event loop every 35ms to ensure OS window and Electron never hang ("Not Responding")
      if (y % 30 === 0) {
        const now = performance.now();
        if (now - lastYieldTime > 35) {
          await new Promise(r => setTimeout(r, 0));
          lastYieldTime = performance.now();
        }
      }

      for (let x = 0; x <= maxSearchX; x += searchStep) {
        // Fast coarse rejection using sparse keypoints (instantly skips >98% of mismatched canvas areas)
        if (kpLen > 0) {
          let failCount = 0;
          let reject = false;
          const maxAllowedFails = Math.min(2, Math.floor(kpLen * 0.2));

          for (let k = 0; k < kpLen; k++) {
            const kp = keyPoints[k];
            const sIdx = ((y + kp.ty) * roiW + (x + kp.tx)) * 4;
            const dr = Math.abs(roiData[sIdx] - kp.r);
            const dg = Math.abs(roiData[sIdx + 1] - kp.g);
            const db = Math.abs(roiData[sIdx + 2] - kp.b);
            const diff = dr + dg + db;
            if (diff > (kp.isFg ? 130 : 160)) {
              failCount++;
              if (failCount > maxAllowedFails) {
                reject = true;
                break;
              }
            }
          }
          if (reject) continue;
        }

        // Full pixel evaluation with early exit
        let weightedDiffSum = 0;
        let totalWeight = 0;
        let fgHits = 0;
        let earlyBreak = false;

        const currentThreshold = Math.max(bestScore, minAcceptableScore);
        const maxAvgDiffAllowed = (1 - currentThreshold) * 255;

        for (let ty = 0; ty < tplH; ty += sampleStep) {
          const sRow = (y + ty) * roiW;
          const tRow = ty * tplW;
          for (let tx = 0; tx < tplW; tx += sampleStep) {
            const tPos = tRow + tx;
            const tIdx = tPos * 4;
            if (tplData[tIdx + 3] < 32) continue;

            const sIdx = (sRow + x + tx) * 4;
            const dr = roiData[sIdx] - tplData[tIdx];
            const dg = roiData[sIdx + 1] - tplData[tIdx + 1];
            const db = roiData[sIdx + 2] - tplData[tIdx + 2];
            const pDiff = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);

            const feature = isFg[tPos];
            const w = feature ? fgWeight : bgWeight;

            if (feature && pDiff < 45) {
              fgHits++;
            }

            weightedDiffSum += pDiff * w;
            totalWeight += w;
          }

          // Early break: if accumulated difference is already mathematically too large, abort!
          if (totalWeight > 60) {
            const curAvg = weightedDiffSum / totalWeight;
            if (curAvg > maxAvgDiffAllowed * 1.35) {
              earlyBreak = true;
              break;
            }
          }
        }

        if (earlyBreak || totalWeight === 0) continue;

        const avgDiff = weightedDiffSum / totalWeight;
        const baseScore = Math.max(0, 1 - avgDiff / 255);
        const sampledFgTotal = Math.max(1, Math.round(fgCount / (sampleStep * sampleStep)));
        const fgRate = fgHits / sampledFgTotal;

        if (hasUniformBg && fgCount > 5 && fgRate < 0.35) {
          continue;
        }

        const score = (hasUniformBg && fgCount > 5)
          ? baseScore * (0.4 + 0.6 * fgRate)
          : baseScore;

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }

    // Refinement step around best candidate if searchStep > 1
    if (searchStep > 1 && bestScore > 0) {
      const minFx = Math.max(0, bestX - searchStep);
      const maxFx = Math.min(maxSearchX, bestX + searchStep);
      const minFy = Math.max(0, bestY - searchStep);
      const maxFy = Math.min(maxSearchY, bestY + searchStep);

      for (let fy = minFy; fy <= maxFy; fy++) {
        for (let fx = minFx; fx <= maxFx; fx++) {
          let weightedDiffSum = 0;
          let totalWeight = 0;
          let fgHits = 0;

          for (let ty = 0; ty < tplH; ty++) {
            const sRow = (fy + ty) * roiW;
            const tRow = ty * tplW;
            for (let tx = 0; tx < tplW; tx++) {
              const tPos = tRow + tx;
              const tIdx = tPos * 4;
              if (tplData[tIdx + 3] < 32) continue;

              const sIdx = (sRow + fx + tx) * 4;
              const dr = roiData[sIdx] - tplData[tIdx];
              const dg = roiData[sIdx + 1] - tplData[tIdx + 1];
              const db = roiData[sIdx + 2] - tplData[tIdx + 2];
              const pDiff = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);

              const feature = isFg[tPos];
              const w = feature ? fgWeight : bgWeight;

              if (feature && pDiff < 45) {
                fgHits++;
              }

              weightedDiffSum += pDiff * w;
              totalWeight += w;
            }
          }

          if (totalWeight === 0) continue;

          const avgDiff = weightedDiffSum / totalWeight;
          const baseScore = Math.max(0, 1 - avgDiff / 255);
          const fgRate = fgHits / Math.max(1, fgCount);

          if (hasUniformBg && fgCount > 5 && fgRate < 0.35) continue;

          const score = (hasUniformBg && fgCount > 5)
            ? baseScore * (0.4 + 0.6 * fgRate)
            : baseScore;

          if (score > bestScore) {
            bestScore = score;
            bestX = fx;
            bestY = fy;
          }
        }
      }
    }

    return { score: bestScore, x: bestX, y: bestY };
  }
}
