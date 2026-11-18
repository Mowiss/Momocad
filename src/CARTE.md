# Carte des modules de MomoCAD

Générée par `node tools/lint.js --carte`. Pour chaque module : ses fonctions et ses variables de premier niveau (partagées avec les autres modules).

## 01-base.js
_ÉTATS ---_

- **75 lignes**, 4 fonctions, 51 variables partagées
- Variables : `canvas`, `ctx`, `camera`, `isPanning`, `lastPanX`, `lastPanY`, `mode`, `isDrawing`, `startX`, `startY`, `currentX`, `currentY`, `rawMouseX`, `rawMouseY`, `shiftHeld`, `currentX_screen`, `currentY_screen`, `typedInput`, `rectDimStep`, `rectWidthVal`, `dimStep`, `dimP1`, `dimP2`, `dimChain`, `dimChainInfo`, `dimTextAligned`, `DIM_STYLE_DEF`, `dimStyle`, `DIM_PXMM`, `dimMmW`, `DIM_DASH`, `detailStep`, `detailTarget`, `detailLabelPos`, `currentPolygon`, `currentSnap`, `arcStep`, `arcCenter`, `arcP1`, `arcRadius`, `arcStartAngle`, `arcAcc`, `arcLastA`, `dimAngleStep`, `dimAngleLine1`, `dimAngleLine2`, `dimAngleIntersect`, `showGrid`, `previewPin`, `gridMm`, `orthoMode`
- Fonctions : `dimStyleSet`, `arcTrack`, `_closestPointOnLine`, `getLineIntersectionInfinite`

## 02-accroches-guide-parametres.js

- **719 lignes**, 76 fonctions, 67 variables partagées
- Variables : `SNAP_DIST_PX`, `selectedShapes`, `moveBasePoint`, `isMovingObjects`, `rotateCenter`, `rotateStartAngle`, `isRotatingObjects`, `scaleCenter`, `scaleRefDist`, `isScalingObjects`, `clipboard`, `clipboardLayers`, `clipboardBasePoint`, `pasteOffset`, `offsetTarget`, `offsetPreviewShape`, `GRID_SIZE`, `unitsPerSquare`, `currentUnit`, `shapes`, `dimensionTextsToDraw`, `screenTextsToDraw`, `pendingTextPos`, `printOrientation`, `cartoucheData`, `PAPER_SIZES`, `CART_W`, `CART_H`, `CART_LOGO`, `CART_FONT`, `CART_A4_W`, `CART_A4_H`, `CART_REV_ROWS`, `UNIT_MM_INIT`, `printSettings`, `UNIT_MM`, `LUN`, `lenF`, `lenDec`, `PRINT_SCALES`, `printScaleIndex`, `currentPrintScale`, `layers`, `INITIAL_LAYERS`, `DIM_LAYER_ID`, `TEXT_LAYER_ID`, `inlineEdit`, `inlineEditReady`, `TEXT_WORLD_SIZE`, `activeLayerId`, `SNAP_DEFAULTS`, `snapSettings`, `trackPts`, `trackLines`, `trackHover`, `cachedSnapPoints`, `cachedSnapXs`, `ptLabelGrid`, `renderEpoch`, `drawCache`, `MIP`, `momoOn`, `momoMode`, `psLogoRemoved`, `psRevs`, `dimEdit`, `matEdit`
- Fonctions : `pasteLayerId`, `cartoucheIndice`, `arrMin`, `arrMax`, `cartDims`, `cartInfo`, `drawCartA4`, `lenTxt`, `applyUnitSettings`, `fmtNum`, `fmtLen`, `pageDims`, `stripLayerNums`, `startInlineEdit`, `autoSizeInline`, `commitInlineEdit`, `cancelInlineEdit`, `imgMip`, `invalidateCache`, `openTextModal`, `applyText`, `closeTextModal`, `openDetailModal`, `closeDetailModal`, `applyDetail`, `closeLayerModal`, `closeCartoucheModal`, `closeSnapModal`, `closeHelpModal`, `openLayerModal`, `openSnapModal`, `loadTuto`, `hgLearnRender`, `momoFresh`, `setMomoOn`, `momoGoIA`, `momoGoHome`, `momoTransform`, `momoUseTuto`, `startTuto`, `printGuide`, `hgFillBtns`, `openHelpModal`, `hgPrintQuick`, `helpChapter`, `helpSearch`, `psTab`, `psSegSync`, `psSheetRefresh`, `psCartRefresh`, `psRevRender`, `psRevAdd`, `psCartTypeUI`, `psCartInputs`, `psRemoveLogo`, `openCartoucheModal`, `saveCartoucheData`, `psDimSet`, `psDimReset`, `psDimPreview`, `psDimRender`, `psMatRender`, `psMatSet`, `psMatAdd`, `psMatDel`, `psMatReset`, `applyCartouche`, `refreshSnapButtons`, `toggleSnap`, `toggleSnapSetting`, `refreshGridField`, `psDecimals`, `psUnitChanged`, `unitChangeDialog`, `scaleDrawing`, `setGridCm`

## 03-fond-de-carte.js

- **245 lignes**, 29 fonctions, 35 variables partagées
- Variables : `basemapStore`, `basemapImgCache`, `bmMap`, `bmMarker`, `bmCircle`, `bmCenter`, `bmLabel`, `bmBusy`, `bmLayer`, `GPF`, `ESRI`, `BM_BASES`, `BM_OVLS`, `BM_OVL_LIST`, `BM_PHOTO`, `BM_OVL_ORDER`, `BM_SAT`, `BM_CAD`, `bmSettings`, `bmBase`, `bmOvlOn`, `bmLLayers`, `psBmMap`, `psBmLayers`, `crsName`, `crsAutoCode`, `crsPrefP`, `worldOfLL`, `llOfWorld`, `bmPlace`, `isOffline`, `tileX`, `tileY`, `lonOfTX`, `latOfTY`
- Fonctions : `bmSaveSettings`, `bmApplyLayers`, `bmRefreshLeaflet`, `psBmForm`, `psBmCenter`, `psBmPreview`, `bmSetCadastre`, `bmSetData`, `bmDataUI`, `bmSetBaseModal`, `bmCapture`, `bmStoreCapture`, `toggleBasemapOverlay`, `toggleBasemapCadastre`, `changeBasemapBase`, `bmSharpen`, `lccParams`, `lccFwd`, `lccInv`, `detectCRS`, `crsConvertAsk`, `crsConvert`, `netWarn`, `startBmPlace`, `bmViewLL`, `bmPlaceLoad`, `bmPlaceSchedule`, `drawBmPlace`, `placeBasemapAt`

## 04-donnees-ign.js

- **167 lignes**, 13 fonctions, 7 variables partagées
- Variables : `TN_API`, `tnBusy`, `CAD_WFS`, `cadBusy`, `bmEmprise`, `BOIS_H`, `ROUTE_W`
- Fonctions : `tnFetch`, `bmWorldOfLL`, `cadGet`, `cadWfs`, `cadParcels`, `cadEtalab`, `cadRings`, `cadFetch`, `bmImportSteps`, `bmImportData`, `boisFetch`, `routesFetch`, `bandTest`

## 05-ecran-chargement.js
_ÉCRAN DE CHARGEMENT : l'écran se floute en fondu, le logo MomoCAD au centre (le M tourne en 3D), la barre de chargement fait le tour du cercle,_

- **99 lignes**, 7 fonctions, 7 variables partagées
- Variables : `ML_COLORS`, `ML_FUN`, `mcLoad`, `mcBreath`, `HYD_W`, `hydDepth`, `hydBank`
- Fonctions : `mcProg`, `smooth6`, `hydroFetch`, `drawRiver2D`, `riverBuild3D`, `cadFetchSelected`, `tnFetchSelected`

## 06-maillages3d-cotations.js

- **309 lignes**, 31 fonctions, 6 variables partagées
- Variables : `meshStore`, `meshPathCache`, `BM_HD`, `bmHdPx`, `isDimMode`, `DIM_CHAIN_LABEL`
- Fonctions : `meshWorld`, `meshCorners`, `meshLocal`, `meshPath`, `drawMesh2D`, `f32ToB64`, `b64ToF32`, `bmImg`, `loadLeaflet`, `bmRadius`, `bmInfo`, `bmSetCenter`, `bmUpdateCircle`, `openBasemapModal`, `closeBasemapModal`, `bmSearch`, `bmLoadTiles`, `buildBasemapLayer`, `bmMissingOv`, `bmStamp`, `validateBasemap`, `orthoOrient`, `dimGeom`, `dimParts`, `drawDimShape`, `makeDim`, `nextChainDim`, `startDimChain`, `endDimChain`, `toggleDimTextAligned`, `refreshDimTextButton`

## 07-vue3d.js

- **134 lignes**, 9 fonctions, 22 variables partagées
- Variables : `geoOrigin`, `zCourant`, `lastTopo`, `NF_CACHE`, `nfFmt`, `fmtZ`, `hasZ`, `realX`, `realY`, `THREE_URL`, `threePromise`, `V3`, `v3Flat`, `v3Nat`, `v3Hour`, `v3HzSeed`, `V3_SKY_VS`, `V3_SKY_FS`, `V3_HZ_KINDS`, `v3HzKind`, `v3PanoTex`, `v3PanoLoading`
- Fonctions : `zAt`, `shapeVertices`, `fillNewZ`, `markZKnown`, `setZCourant`, `editZ`, `loadThree`, `place3D`, `v3SunDir`

## 08-decor-relief.js
_TA PHOTO DE PAYSAGE : une photo d'horizon (champ, haies, montagnes au loin…) posée tout autour sur la ligne d'horizon, répétée en miroir_

- **210 lignes**, 28 fonctions, 12 variables partagées
- Variables : `HZ_IMG`, `HZ_IMG_LOAD`, `hzImgSet`, `REAL`, `REAL_LOAD`, `REAL_OUT`, `REAL_NEAR`, `realOn`, `REAL_HD`, `V3_LAND_IC`, `V3_LAND_ORDER`, `V3_LAND_NAME`
- Fonctions : `hzImgTex`, `hzImgBuild`, `v3ImgFadeTex`, `hzImgPick`, `hzImgLine`, `realSite`, `realSet`, `realLoad`, `realLoadHD`, `realFetch`, `realLand3D`, `v3RealFog`, `skyBlobCanvas`, `v3PanoAvg`, `v3SkyFadeTex`, `v3PanoFade`, `v3PanoFromBlob`, `v3PanoPick`, `v3HorizonTex`, `v3Sky`, `v3SetHour`, `v3LandUI`, `v3HzCycle`, `v3HzType`, `v3NewHorizon`, `v3EnvPlace`, `v3Tog`, `v3Band`

## 09-studio-rendu.js
_STUDIO PHOTO : cadrer une photo de la maquette (format, focale, vues enregistrées), la photo 360° et ses réglages, puis le RENDU :_

- **433 lignes**, 57 fonctions, 34 variables partagées
- Variables : `ST_FMT`, `ST_RES`, `RD_Q`, `ST_GRAN`, `ST_DENS`, `studio`, `stPano`, `stOn`, `stVFov`, `stGrassTxt`, `stCm`, `stSecOpen`, `stDensTxt`, `stGrassP`, `stEarthMul`, `stGranD`, `stGranName`, `stGranTxt`, `stEarthNat`, `ST_THUMB`, `v3Tab`, `V3_TABS`, `v3PanelOpen`, `v3Chk`, `stHourTxt`, `RD`, `RD_LAST`, `rdWait`, `rdSec`, `isGreenPx`, `WAVE_TEX`, `EYE_ON`, `EYE_OFF`, `is3DOpen`
- Fonctions : `studioNew`, `stPanoSave`, `stFrame`, `stCamApply`, `stFrameShow`, `stResWH`, `stViewNow`, `stViewGo`, `stViewAdd`, `stViewDel`, `stViewName`, `stSet`, `stOrbit`, `stPanoSet`, `studioOpen`, `fpsStudioHold`, `studioClose`, `studioPanel`, `stSecSave`, `stGrassSet`, `stEarthCol`, `stPreview`, `stThumb`, `v3Panel`, `v3PanelRefresh`, `v3PanelClose`, `v3PanelShow`, `v3SetChk`, `v3TabHTML`, `v3Exag`, `rdUI`, `rdStep`, `rdSave`, `rdShadowFit`, `rdLightAt`, `rdShadowsOff`, `studioRender`, `rdCompose`, `v3SmoothNormals`, `bgPixAt`, `bgGreenAvg`, `v3GrassTint`, `v3NoSow`, `v3Grass3D`, `v3Earth3D`, `waveTex`, `v3WaterMat`, `rdReflUpdate`, `v3RiverBanks`, `boisCrownGeo`, `open3D`, `open3D_`, `v3ParamSel`, `close3D`, `toggle3D`, `refresh3DButton`, `init3D`

## 10-balade-momo.js
_VUE MOMO (première personne) : on attrape Momo (clic maintenu + glisser), on le pose sur le plan ou dans la vue 3D ;_

- **528 lignes**, 22 fonctions, 4 variables partagées
- Variables : `FPS_EYE`, `FPS_STEP`, `fpsLeaves`, `FPS_FK`
- Fonctions : `fpsGrid`, `fpsTri`, `fpsFloor`, `fpsBlocked`, `fpsDoor`, `groundZAt`, `momoFPS`, `momoFPS_`, `fpsStop`, `fpsLoop`, `fpsStep`, `fpsPause`, `fpsResume`, `fpsBubbles`, `fpsBubble`, `fpsFBadges`, `fpsFKey`, `fpsLook`, `planWire3D`, `build3DScene`, `delaunay`, `fit3D`

## 11-coupe-perspective.js
_COUPE EN PERSPECTIVE : la vue 3D tronquée au trait de coupe (tout ce qui est devant est retiré), regardée dans le sens de la coupe._

- **152 lignes**, 18 fonctions, 3 variables partagées
- Variables : `CMD_ALIASES`, `cmdBuffer`, `lastTool`
- Fonctions : `v3CutPlanes`, `v3CutCaps`, `v3CutApply`, `refreshV3CutBtn`, `v3CutView`, `cutLineOf`, `sec3D`, `v3CutStyle`, `v3CutToggle`, `render3DSoon`, `v3FullRes`, `render3D`, `animate3D`, `view3D`, `roseClick`, `spin3D`, `relaunchLastTool`, `runCmdAlias`

## 12-mnt-terrain-fini.js

- **247 lignes**, 12 fonctions, 4 variables partagées
- Variables : `tinCache`, `PSURF`, `FM_CACHE`, `SEG_GRID`
- Fonctions : `isPlateforme`, `earClip`, `platSurf`, `platZAt`, `nearOnRing`, `edgeNearZ`, `platLabel`, `platRing`, `platZ`, `finishedModel`, `finishedModel0`, `cubatureTalusModel`

## 13-ecoulement-pluie.js

- **350 lignes**, 58 fonctions, 15 variables partagées
- Variables : `EC`, `EC_SURF`, `MAIL_INF`, `ecRainMin`, `ecDt`, `ecRainAt`, `ecW`, `TIN_MAX`, `TIN_PREV`, `slopeP1`, `nfr`, `mOf`, `talusCotPending`, `CARTO_GROUP`, `isCartoLayer`
- Fonctions : `ecGrid`, `ecSurfOf`, `ecRates`, `mailInfRate`, `ecFill`, `ecRetentions`, `ecRetFill`, `ecStep`, `ecPuddles`, `ecRun`, `ecLatLon`, `ecStorms`, `ecRealFetch`, `ecHyetoSvg`, `ecRealRender`, `ecPickStorm`, `ecOpen`, `ecRead`, `ecPreUI`, `ecClose`, `ecReset`, `ecToggle`, `ecLoop`, `ecHud`, `ecRetRender`, `ecDone`, `ecSee`, `ecMark`, `ecDraw2D`, `ecRing2D`, `ecLocal`, `ecBuild3D`, `ecAttach3D`, `ecFrame3D`, `ecStorm`, `ecFlashTick`, `ecUpd3D`, `ecRender`, `toggleLayerTin`, `tinNodes`, `tinThin`, `buildTIN`, `tinSig`, `getTIN`, `tinZ`, `zHere`, `makeSlope`, `slopeLabel`, `slopePct`, `drawSlopeShape`, `openTopoModal`, `closeTopoModal`, `downloadText`, `copyText`, `talusCotLayer`, `cartoGroup`, `cartoGroupAll`, `ensureLayer`

## 14-profil-courbes.js

- **181 lignes**, 15 fonctions, 2 variables partagées
- Variables : `profileAxis`, `lastProfile`
- Fonctions : `finishProfileAxis`, `computeProfile`, `profileTable`, `drawProfileChart`, `showProfile`, `profileRows`, `refreshProfileTable`, `profileTSV`, `insertProfileDrawing`, `openContoursDialog`, `contourPreview`, `contourStyleApply`, `contourLevels`, `contourPolylines`, `generateContours`

## 15-cubatures.js

- **973 lignes**, 68 fonctions, 11 variables partagées
- Variables : `TALUS_OPTS`, `cubEmprise`, `cubState`, `cubResult`, `TALUS_CACHE`, `MOUSE_HELD`, `TALUS_STALE`, `CUB_STEPS`, `cubInput`, `cubCC`, `cubZp`
- Fonctions : `empriseOf`, `selectedEmprise`, `pickEmpriseAt`, `polyArea`, `polySelfX`, `polyCentroid`, `clipHalf`, `cubaturePlateforme`, `cubatureSurfaces`, `platTalus`, `talusGeom`, `solidMesh3D`, `drawSolid2D`, `talCorners`, `talRingR`, `paroiCovered`, `paroiVOff`, `drawParois2D`, `talStairRuns`, `drawTalus2D`, `refresh3D`, `talusOk`, `talusK`, `polyOffsetPts`, `polyOffsetVar`, `distToPoly`, `cubatureTalus`, `gridContour`, `cubCard`, `platName`, `cubPlatforms`, `openCubatureDialog`, `saveCubState`, `cubGo`, `cubCheck`, `pickCubEmprise`, `cubMakePlatform`, `cubRP`, `gridEach`, `rpMode`, `rpTop`, `rpDistGrid`, `rpTalusExt`, `cubPeriph`, `cubRecul`, `cubRPon`, `cubToggle`, `cubAll`, `cubRename`, `cubShow`, `cubEdit`, `renderCubStep`, `cubComputeCached`, `cubCompute`, `bassinCubData`, `bassinCubHTML`, `runCubature`, `surfDown`, `shiftSurf`, `cubDetail`, `cubDetailCopy`, `cubRamp`, `cubRampRGB`, `cubLevels`, `cubLogoPNG`, `cubIsoImage`, `cubPDF`, `drawCubLines`

## 16-semis-metre-notes.js

- **341 lignes**, 35 fonctions, 10 variables partagées
- Variables : `metreQ`, `CALC_TABS`, `calcCur`, `pluvioNote`, `PLUV_C`, `pvSC`, `pdfTxt`, `calcPrint`, `polyEdges`, `moveTypedX`
- Fonctions : `importSemisFile`, `exportSemis`, `shapeLengthM`, `shapeAreaM2`, `metreData`, `_metreData`, `metreQuant`, `metreQRowVals`, `calcTabs`, `calcTab`, `pluvioCfg`, `pluvioSurf`, `pluvioSurf0`, `pluvioCalc`, `pluvioSaveTest`, `openPluvio`, `pluvioRender`, `pluvioFlowSVG`, `pluvioBassins`, `pluvioBassinsHTML`, `pluvioTSV`, `calcPdfHeader`, `pluvioPDF`, `openCalcPrint`, `calcPrintPreview`, `calcCubReady`, `calcPrintOne`, `calcDossierPDF`, `openMetre`, `metreRowsNow`, `renderMetre`, `metrePDF`, `metreTSV`, `translateShape`, `moveTypedOffset`

## 17-fonds-perso-pdf.js

- **1011 lignes**, 99 fonctions, 28 variables partagées
- Variables : `isBg`, `bgSrc`, `PDFJS_URL`, `pdfjsPromise`, `busyT0`, `pdfTopoLayer`, `GLYPH_T`, `FILL_T`, `FILL_CV`, `gcal`, `vecStore`, `vecCache`, `vecPack`, `vecUnpack`, `vecW`, `vecExact`, `pdfVecCache`, `pdfPlanName`, `piW`, `PI_CAT`, `piTalList`, `batN0`, `pdfBatLayer`, `vecHatchCache`, `calTarget`, `calP1`, `calP2`, `layerIdSeq`
- Fonctions : `loadPdfJs`, `bgInfo`, `busyStep`, `busyEnd`, `bgProg`, `loadBgFile`, `renderPdfPage`, `bgRenderPreview`, `bgSt`, `bgEchChips`, `bgEchSet`, `bgEchTyped`, `bgGridToggled`, `closeBgModal`, `insertBgImage`, `pdfRuns`, `pdfPageVec`, `pdfReadTopo`, `pdfReadVectors`, `pdfTalus`, `pdfStitch`, `pdfChain`, `pdfSegX`, `glyphRaster`, `glyphClass`, `pdfGlyphRuns`, `fillGlyphTemplates`, `fillGridFrom`, `fillGlyphClass`, `pdfFillGlyphRuns`, `pdfGlyphToPdf`, `pdfReadGrid`, `pdfGuessCrs`, `pdfGridFit`, `bgApplyGrid`, `bgPlaceFit`, `bgGridMsg`, `bgGridApplyUI`, `gcalStart`, `gcalPage`, `gcalPageWH`, `gcalSnap`, `gcalAsk`, `gcalApply`, `gcalDraw`, `bgUV`, `pdfTopoDialog`, `piPosPrev`, `vecMake`, `vecInfo`, `vecM`, `vecP`, `vecCorners`, `vecNear`, `vecHit`, `vecSnapPts`, `vecWeight`, `drawVec2D`, `vecTiles`, `vecTilePath`, `vecStroke`, `vecExplode`, `vecExplodeUI`, `pdfImport`, `piWizStart`, `piWClose`, `piWGo`, `piWRender`, `piWAct`, `piLayCats`, `piLayApply`, `batStart`, `batBar`, `hatchRegions`, `dpSimplify`, `vecHatchBats`, `pdfBats`, `pdfBatsLayer`, `batOutlines`, `pdfBatPolys`, `pdfBatPlace`, `pdfZPoints`, `pdfBreakline`, `pdfTalusPlace`, `pdfTracesPlace`, `pdfTopoPlace`, `pdfTopoReload`, `pdfReadAll`, `bgLocal`, `bgCorners`, `applyCalibration`, `startCalibrate`, `basemapCredit`, `shapesInDrawOrder`, `toggleGrid`, `toggleOrtho`, `newLayerId`, `generateId`, `renameLayerUI`

## 18-calques-fenetre-y.js
_Apparence des points topo, réglée par calque ----_

- **529 lignes**, 62 fonctions, 23 variables partagées
- Variables : `PT_SYMS`, `LD_EYE`, `layDDOpen`, `layDDQ`, `ldEsc`, `layDrag`, `layMgrClosed`, `PEN_MM`, `MF`, `spLive`, `_spLive`, `spLiveT`, `spNum`, `SP_FIG`, `MAT_PU`, `TUBE_DEFAULTS`, `MAT_DEFAULTS`, `matCatalog`, `MAT_OLD`, `structMat`, `matLabel`, `PU_UNIT`, `structEdit`
- Fonctions : `ptStyleOf`, `ptLabelLines`, `drawPtSymbol`, `ptSymIcon`, `ptStylePreview`, `openPtStyle`, `ptStyleOutside`, `closePtStyle`, `setPtStyle`, `updateLayerUI`, `layDDCur`, `layDDToggle`, `closeLayDD`, `layGroupOf`, `layLabel`, `layGroupNames`, `layDnD`, `layMove`, `layMoveToGroup`, `setLayerGroup`, `layGroupRename`, `layGroupUngroup`, `layGroupRenameUI`, `layMgrRender`, `layDDGroups`, `layDDRender`, `layDDPick`, `layDDFold`, `layDDGroupVis`, `layDDAll`, `changeActiveLayer`, `setActiveLayer`, `toggleLayerVis`, `layPenOpts`, `setLayerStyle`, `spChapter`, `selKind`, `mfClampScan`, `spLiveCommit`, `spCancel`, `spLiveApply`, `spFigMount`, `spFigRedraw`, `spThumb`, `openSelectionParamModal`, `matCatalogFix`, `matSave`, `matCost`, `structOf`, `structThick`, `structQty`, `terrQty`, `structRows`, `structQtyHTML`, `structStyle`, `structSVG`, `structRefresh`, `structRerender`, `structSet`, `structAdd`, `structDel`, `structSum`

## 19-tranchees-eau-vegetation-bassins.js

- **477 lignes**, 66 fonctions, 36 variables partagées
- Variables : `trenchDraw`, `trEdit`, `trEditFrom`, `brkDraw`, `TR_KEY`, `trDefault`, `TR_DEFAULT_TYPES`, `trTypes`, `trCur`, `trClone`, `trNum`, `trM`, `trGc`, `trSelV`, `waterDraw`, `WATER_CACHE`, `boisDraw`, `VEG_K`, `vegOpt`, `STAIR_MAT`, `stairOpt`, `stairA`, `stairEdit`, `blondel`, `roadCache`, `roadIdxC`, `segCross`, `roadAt`, `roadPat`, `BASSIN_T`, `BASSIN_LIT`, `bassinDraw`, `bassinTalK`, `PAY_ID`, `payCur`, `bassinCur`
- Fonctions : `trTypesSave`, `trLayerId`, `trMatName`, `trTubeDn`, `trLayerBands`, `trTubeLayout`, `trDiscBand`, `trSection`, `trGround`, `trNode`, `trSync`, `trSlope`, `trQty`, `trQtyRows`, `trOffset`, `trLabelPos`, `drawTrench2D`, `trVertexAt`, `trVertexDialog`, `vegSave`, `vegPanel`, `vegSet`, `startBois`, `boisCreate`, `startStair`, `stairPanel`, `stairSVG`, `stairBl`, `blondelBox`, `stairSet`, `stairSave`, `stairGround`, `stairRebuild`, `stairFrameSync`, `stairMake`, `stairClick`, `drawStair2D`, `drawStairPreview`, `stair3D`, `roadPolys`, `roadIdx`, `roadClipTri`, `drawRoad2D`, `bassinDef`, `bassinCalc`, `bassinList`, `bassinRows`, `startBassin`, `bassinMake`, `payMake`, `payApplyGeom`, `payCalc`, `paySync`, `payPanel`, `paySet`, `payApply`, `payLabel2D`, `paySVG`, `bassinCreate`, `bassinPanel`, `bassinSet`, `bassinApply`, `bassinRes`, `bassinSVG`, `drawBassin2D`, `bassin3D`

## 20-maillage-plateformes.js
_MAILLAGE : sondages géotechniques (G2) et diagnostic pollution ----------_

- **830 lignes**, 131 fonctions, 21 variables partagées
- Variables : `MAIL_SUB`, `MAIL_CL`, `MAIL_POL`, `mailDraw`, `mailCur`, `mailClip`, `mailNote`, `mailPick`, `MAIL_HYD`, `mailT`, `mailNm`, `mailCol`, `mailEsc`, `mailSel`, `mailSond`, `mailZoneDraw`, `mailCC`, `TR_HK`, `spDirPick`, `TAL_ST_MAT`, `spSelSig`
- Fonctions : `mailDef`, `mailList`, `mailSets`, `mailLayer`, `mailHydSync`, `mailTops`, `startMaille`, `mailMake`, `mailFinish`, `mailCreate`, `mailSVG`, `mailPanel`, `mailCellBody`, `mailNappe`, `mailToggle`, `mailWorst`, `mailAddCell`, `mailLegendItems`, `mailLegendHTML`, `mailLegendDraw`, `mailSonds`, `mailSondStart`, `mailTagNew`, `mailZoneStart`, `mailZoneCreate`, `mailClipHalf`, `mailSplit`, `mailResplit`, `mailWide`, `mailApply`, `mailSetName`, `mailKind`, `mailEd`, `mailAdd`, `mailDel`, `mailCopy`, `mailPaste`, `mailParse`, `mailImport`, `mailDrag`, `drawMaille2D`, `mailDecomp`, `mailNoteCfg`, `mailCubHTML`, `mailCubTSV`, `startWater`, `startWaterOld`, `waterLayerId`, `waterCreate`, `waterMask`, `drawWater2D`, `waterShore`, `waterBuild3D`, `trBuild3D`, `trLabelAt`, `trHatchKind`, `trHi`, `trSvg`, `trMatOpts`, `trEditorHTML`, `trSumHTML`, `trRefresh`, `trRerender`, `trSet`, `trLay`, `trTube`, `trAdd`, `trDel`, `trMove`, `trLoadType`, `trSaveType`, `openSettingsMat`, `startTrench`, `trHistPush`, `trStartDraw`, `trCreate`, `trNodesHTML`, `trQtyHTML`, `trApplyY`, `trOpenNode`, `trAllRows`, `openTrenchMetre`, `trPick`, `trMetreTSV`, `openTrenchTypes`, `trTypeRename`, `trTypeDel`, `trTypesReset`, `talusInfo`, `talusSum`, `spWallH`, `spPlatMode`, `spVertexZs`, `spPlanInfo`, `spFillSlope`, `spPickDir`, `spDirClick`, `solidRows`, `solidVolume`, `talEdgeTN`, `talHL`, `talDiagram`, `talDiagramR`, `talPzHtml`, `talPzRead`, `talStairHtml`, `talStPente`, `talStRead`, `talStUpd`, `talStair`, `talEdgeType`, `talMiniPlan`, `talOpenEdge`, `talParoi`, `talMode`, `talusRows`, `talCx`, `talHi`, `drawTalusPills`, `spTabify`, `spFollowSel`, `spTabGo`, `closeSelectionParamModal`, `applySelectionLayer`, `_applySelectionLayer`, `addLayer`, `deleteLayer`, `pointInPolygon`, `computeHatchLines`, `clipLineToShape`, `segLineIntersect`

## 21-zones-fermees.js

- **381 lignes**, 19 fonctions, 0 variables partagées
- Variables : —
- Fonctions : `hatchBoundarySegments`, `findClosedRegion`, `fmtSurface`, `pointInHatch`, `hatchArea`, `isAngleBetween`, `getIntersectionLines`, `getIntersectionLineCircle`, `getIntersectionCircles`, `shapeTouchesRect`, `getSegments`, `getInterPoints`, `getAllIntersections`, `applyRotationToShape`, `applyScaleToShape`, `screenToWorld`, `worldToScreen`, `calculateRealDistance`, `getShapesBoundingBox`

## 22-accroche-ajuster.js

- **568 lignes**, 19 fonctions, 0 variables partagées
- Variables : —
- Fonctions : `getSnapPoints`, `findSnap`, `trackIntersections`, `updateTrackHover`, `findPerpendicularFoot`, `isPointInRect`, `findShapeAt`, `_findShapeAt`, `bSegs`, `toolVisOthers`, `toolPick`, `lineCutParams`, `trimShapeAt`, `trimPolyAt`, `loadPolyClip`, `pcHarden`, `trimHatchAt`, `extendShapeAt`, `drawAngleDim`

## 23-cotes-solides-fondations.js
_DIMENSIONNELLEMENT EXACT : une cote de N mm doit mesurer N mm sur le papier._

- **238 lignes**, 37 fonctions, 11 variables partagées
- Variables : `flashMsg`, `flashUntil`, `SOLID_NAMES`, `SOLID_POLY`, `solidTool`, `solidBaseLen`, `solidDalle`, `FOND_T`, `fondTool`, `fondBase`, `fondPick`
- Fonctions : `printBaseZoom`, `expandGroups`, `selectionHasGroup`, `groupSelection`, `explodeOrUngroup`, `ungroupSelection`, `updateGroupButtons`, `isScaleMode`, `applyScaleFromTyped`, `updateCommandMessageText`, `togglePal`, `restorePal`, `markActivePal`, `startSolidTool`, `startPoteau`, `poteauClick`, `fondDalles`, `fondTopAt`, `fondTopZ`, `fondH`, `fondZs`, `fondSync`, `fondRecale`, `fondSyncAll`, `fondLayer`, `fondPanel`, `fondSVG`, `fondListHTML`, `fondSet`, `fondRead`, `startFond`, `fondMake`, `fondGo`, `fondIsolee`, `fondClick`, `fondTagNew`, `tagNewSolid`

## 24-blocs-bois-bati.js

- **332 lignes**, 34 fonctions, 28 variables partagées
- Variables : `BLK_TABS`, `blkParois`, `bkEll`, `bkRect`, `bkRRect`, `bkScallop`, `BLOCKS_BUILTIN`, `userBlocks`, `blkTab`, `allBlocks`, `BOIS_S`, `BOIS_R`, `boisS`, `boisHash`, `boisTreeCache`, `BOIS_TRIG`, `BOIS_PATHS`, `BARK_TEX`, `CAD_BATI_H`, `CAD_BATI_P`, `isCadBati`, `bmPixCache`, `BLK3`, `BK_COL`, `blkHas3D`, `blkThumbCache`, `stamp`, `BLK_COLORS`
- Fonctions : `blockBBox`, `blockShapes`, `boisTrees`, `boisEnvKey`, `boisTrees1`, `boisTrees0`, `drawBois2D`, `bois3D`, `barkTex`, `boisMake`, `boisUnset`, `boisSetTex`, `boisSetKind`, `boisSetH`, `cadBatiBase`, `bmPixels`, `roofColorFromMap`, `bmColorDisc`, `cadBati3D`, `bkParts`, `blkRefs`, `blkGeom3D`, `blk3DBuild`, `blockThumb`, `wallSec`, `renderBlockMenu`, `openParois`, `toggleBlockMenu`, `startStamp`, `drawStampPreview`, `blockLayerId`, `placeStamp`, `addUserBlock`, `removeUserBlock`

## 25-gabarits-vues-2d.js

- **237 lignes**, 20 fonctions, 11 variables partagées
- Variables : `gabaritName`, `D2R`, `view2d`, `view2dAnim`, `view2dPivot`, `isOrthoView`, `projUV`, `orthoRend`, `orthoKey`, `orthoLoading`, `ROSE_AXES`
- Fonctions : `idbStore`, `gabaritData`, `updateGbtLabel`, `applyGabarit`, `loadGabaritFile`, `saveGabarit`, `restoreLastGabarit`, `zRange`, `viewName`, `setView2D`, `orbitView`, `orthoCenterCamera`, `ortho3D`, `drawOrthoView`, `roseSVG`, `roseFit`, `roseSpinSVG`, `roseTilt`, `roseSpin`, `updateRose`

## 26-parois-poignees.js

- **348 lignes**, 27 fonctions, 10 variables partagées
- Variables : `WALL_MATS`, `WALL_PRESETS`, `wallOpt`, `wallThick`, `wallTool`, `wallStart`, `wallChain`, `gripDrag`, `gripHover`, `GRIP_MAX`
- Fonctions : `wallOptSave`, `wallBase`, `wallBands`, `wallRand`, `wallPattern`, `drawWall`, `wallFromPreset`, `wallThumb`, `startWall`, `wallSegs`, `wallLayerId`, `wallRect`, `wallChainGeom`, `wallChainShapes`, `wallFuse`, `wallChainEnd`, `wallAddTo`, `wallChainLive`, `wallTarget`, `gripsOf`, `shapeCenterOf`, `allGrips`, `gripAt`, `startGrip`, `gripApply`, `endGrip`, `drawGrips`

## 27-polylignes-modifier.js

- **358 lignes**, 49 fonctions, 19 variables partagées
- Variables : `isPolyMode`, `batDraw`, `batSrcCache`, `batCand`, `batCandT`, `penPts`, `penDrag`, `PEN_STEPS`, `mirrorA`, `mirrorB`, `mirrorPending`, `mirrorSel`, `wallEdit`, `stretchWin`, `stretchA`, `stretchBase`, `filletA`, `filletB`, `filletR`
- Fonctions : `rdpSimplify`, `lightenTalusLimits`, `cleanPolyPts`, `brkMake`, `brkFromSel`, `batList`, `batEdgeDist`, `batAt`, `batCotes`, `batMake`, `batPick`, `batSrc`, `batCandAt`, `batHover`, `batDrawCand`, `batHeightAsk`, `batSetTop`, `batWatch`, `batMsg`, `batFromSel`, `batUnset`, `batRefresh`, `finishPline`, `bezPt`, `penFlatten`, `finishPen`, `penDown`, `penMove`, `penUp`, `drawPenPreview`, `startMirror`, `mirrorPointFn`, `applyMirrorToShape`, `mirrorClones`, `mirrorTargetB`, `mirrorClick`, `mirrorApply`, `drawMirrorPreview`, `drawWallPreview`, `wallEditorHTML`, `wallSync`, `wallRender`, `stretchShape`, `stretchTargets`, `drawStretchPreview`, `stretchApply`, `explodeSelection`, `doFillet`, `filletApply`

## 28-balayage-geometrie3d.js

- **362 lignes**, 29 fonctions, 14 variables partagées
- Variables : `SWEEP_PRESETS`, `SWEEP_DIMS`, `sweepPreset`, `SWEEP_CACHE`, `SWEEP_SRC`, `isSweepPath`, `lastSweepPreset`, `lastSweepPlace`, `sweepPickFor`, `lastBeamPreset`, `sweepEdit`, `is3DObj`, `P_M`, `Z_M`
- Fonctions : `sweepDefault`, `sweepProfile`, `sweepPath`, `sweepStations`, `sweepGeom`, `sweepGeomCached`, `drawSweep2D`, `sweepMesh3D`, `sweepInfo`, `sweepShapes`, `startSweep`, `sweepRows`, `sweepInfoHTML`, `sweepSet`, `sweepRemove`, `sweepRerender`, `sweepSum`, `sweepPickProfile`, `sweepUseProfile`, `sweepToXD`, `sweepFromXD`, `wallEdges3D`, `joinery3D`, `flatEdgesClean`, `objGeom3D`, `geomTris`, `objTrisMM`, `signedVol`, `flipTris`

## 29-csg-murs-ouvertures.js

- **328 lignes**, 38 fonctions, 12 variables partagées
- Variables : `CSG`, `BOOL_NAMES`, `boolKind`, `boolA`, `openA`, `openWall`, `isWallHatch`, `openDir`, `openLast`, `opStretch`, `opDiaCtx`, `openSel`
- Fonctions : `csgTris`, `csgGeom`, `meshFromTris`, `meshVolume`, `startBool`, `pick3DObj`, `boolClick`, `runBool`, `wallGroupOf`, `wallOpeningsFor`, `openSegHit`, `segInter`, `openingGeom`, `startOpening`, `wallAt`, `openingDirAt`, `openingLayerSpans`, `openingSpanAuto`, `openingPts`, `opStretchStart`, `opStretchT`, `opStretchTT`, `opStretchClick`, `drawOpStretchPreview`, `openingB`, `openingClick`, `openingFinish`, `drawOpeningPreview`, `openingDialog`, `opKind`, `opDiaDraw`, `drawOpenings2D`, `spOpenEdit`, `openingSnapPts`, `opLayerId`, `opLayer`, `opHidden`, `openingAt`

## 30-toitures-manip3d.js
_TOITURE complète : 1 ou 2 pans à partir d'un contour, hauteurs d'égout et de faîtage, pignons comblés ----_

- **458 lignes**, 37 fonctions, 6 variables partagées
- Variables : `roofLast`, `RF_CX_TYPES`, `RF_CX_DEF`, `rfCx`, `stackObjs`, `tiltOf`
- Fonctions : `roofDialog`, `rfCxHtml`, `rfCxSum`, `rfCxDraw`, `rfCxMove`, `tmTabify`, `rfSw`, `rfDia`, `roofEdit`, `roofBuildFromDialog`, `ringOffset`, `roofLayerId`, `buildTerrace`, `roofSkeleton`, `buildRoof`, `roofEave`, `roofRise`, `roofMesh`, `drawRoof2D`, `shiftZ`, `solidHeight`, `objMinZ`, `objTopZ`, `openElevate`, `applyElevate`, `startStack`, `stackClick`, `startTilt`, `tiltClick`, `tiltPt`, `solidPivot`, `solidSamples`, `hull2`, `tiltFootprint`, `drawTilt2D`, `tiltGeom3D`, `pick3D`

## 31-travail-3d-coupes.js

- **515 lignes**, 53 fonctions, 12 variables partagées
- Variables : `D3_MODES`, `D3`, `d3Active`, `D3_KIND`, `D3_TIP`, `isCL`, `D3C`, `CL2`, `cl2Cache`, `CUT`, `secTimer`, `d3Col`
- Fonctions : `d3Reset`, `d3ToPlan`, `d3Point`, `d3Lock`, `d3PlaneRect`, `d3Mark`, `d3Rubber`, `d3Msg`, `d3Hover`, `d3Start`, `d3Click`, `clMake`, `d3ClScene`, `d3ClDir`, `d3ClAdd`, `d3ClClear`, `cl2Chip`, `d3ClBuild`, `drawCLines`, `drawCLine2D`, `cl2Edge`, `cl2Add`, `cl2LineAt`, `cl2Erase`, `cl2Click`, `cl2Key`, `cutLayerId`, `cutClick`, `cutReset`, `cutFlip`, `cutValidate`, `cutOrigin`, `cutBar`, `cutKey`, `cutPreview`, `cutFrame`, `makeSection`, `secSceneMM`, `sectionData`, `sectionPlace`, `secMarks`, `secBuild`, `secSchedule`, `secRefreshAll`, `secRefresh`, `d2ClSnaps`, `d3ObjName`, `d3Collisions`, `d3ColDraw`, `d3ColPick`, `d3ColClear`, `d3Finish`, `d3Key`

## 32-outils-complementaires.js
_Révolution : un profil fermé tourne autour d'un axe vertical (regard, cuve, poteau, plot…) ----_

- **664 lignes**, 75 fonctions, 15 variables partagées
- Variables : `revProf`, `revAxis`, `t2`, `t2Polar`, `T2_POLAR_STEPS`, `t2IsPath`, `t2Inp`, `t2Row`, `t2Chk`, `t2Note`, `t2Btn`, `t2Tab`, `vSeg`, `t2Joinable`, `t2Lengthable`
- Fonctions : `startRevolve`, `revolveClick`, `extrudeShapes`, `startExtrude`, `T2W`, `T2U`, `t2Num`, `t2Fr`, `t2Props`, `t2Pt`, `t2Vis`, `t2SegDist`, `t2Clone`, `t2PolarAt`, `t2Constrain`, `refreshPolarBtn`, `togglePolar`, `cyclePolarStep`, `t2Origin`, `t2MouseMove`, `t2ArcSweep`, `t2OnArc`, `t2TangentSnap`, `t2NearestSnap`, `t2PathOf`, `t2PathAt`, `t2Panel`, `t2PanelClose`, `t2Reset`, `t2CopyPlace`, `t2CopyTyped`, `t2RotCopy`, `startArray`, `t2ArrayPanel`, `t2ArrRead`, `t2ArrInfo`, `t2ArrayXf`, `t2ApplyXf`, `t2ArrayApply`, `startJoin`, `t2DoJoin`, `t2VertexAt`, `t2DelPt`, `t2AddPt`, `t2Break`, `t2Chamfer`, `t2ChamferApply`, `t2LenOf`, `t2EndsOf`, `t2LenSet`, `t2LenDynT`, `t2LenClick`, `t2LenFinish`, `t2EllPts`, `t2EllB`, `t2EllCreate`, `t2EllClick`, `t2DivStations`, `t2DivShapes`, `t2DivClick`, `t2DivPanel`, `t2DivRead`, `t2DivInfo`, `t2DivApply`, `t2DimRGeom`, `dimTxt`, `t2DimRText`, `dimTermAt`, `drawDimR`, `t2DimRMake`, `t2DimRClick`, `t2DimRDXF`, `t2DimRHit`, `t2MsInfo`, `t2MsText`

## 33-clavier-souris.js

- **303 lignes**, 14 fonctions, 1 variables partagées
- Variables : `t2Sel`
- Fonctions : `t2KeyDown`, `t2SrefApply`, `t2MouseDown`, `t2Message`, `t2Label`, `t2Ghost`, `t2DrawPreview`, `ty2`, `t2SnapUsed`, `t2SnapMarker`, `t2SelDown`, `t2SelMove`, `t2KeyPts`, `t2SelUp`

## 34-textures-pinceau.js

- **470 lignes**, 54 fonctions, 29 variables partagées
- Variables : `texSpeck`, `texRows`, `TG`, `TEX_CATS`, `TEX_LIB`, `texCanvasCache`, `texNormCache`, `texHeightCache`, `texThumbCache`, `texAvgCache`, `texPaint`, `texLast`, `TEX_NAMES`, `paintModeLast`, `texCat`, `brushTool`, `brushCur`, `brushCat`, `brushRAF`, `brushLast`, `brushSwitching`, `brush2DAt`, `brushPolyDraw`, `brush2D`, `brushNoSync`, `brushAll`, `BR_N`, `BRP_N`, `BR_HATCH`
- Fonctions : `texRand`, `texCanvas`, `texNormal`, `texPOM`, `texThumb`, `texGeometry`, `texAvg`, `texMaterial`, `texMaterial0`, `paintBar`, `paintMode`, `startPaint`, `texMsg`, `texStop`, `texPanel`, `texCatSet`, `texChoose`, `texTargets`, `texApply`, `paroiPaint`, `brushSaveOpt`, `brushLayer`, `startBrush`, `brushMsg`, `brushStop`, `brushSet`, `brushPlace`, `brushPolyCreate`, `brushView`, `brush2DHit`, `drawBrush2DCursor`, `brushChoose`, `brushCatSet`, `brushPanel`, `v3BrushHit`, `brushDown`, `brushMove`, `brushUp`, `brushPolyClick`, `brushPolyEnd`, `brushPolyCancel`, `brushZoneAt`, `brushZoneRepaint`, `brushPickClick`, `brushPaintSel`, `brushErase`, `brushQueue`, `v3BrushCursor`, `brushMat`, `brushPolyMat`, `brushSubGeom`, `v3BrushBuild`, `brushHatch`, `drawBrush2D`

## 35-etages-batiments.js
_ÉTAGES : niveaux du bâtiment (sous-sols, RDC, étages, toit). Outil actif : on voit l'étage choisi et tout ce qui est dessous ----_

- **184 lignes**, 53 fonctions, 9 variables partagées
- Variables : `lvls`, `lvlOn`, `lvlAct`, `bldActId`, `lvlsGlobal`, `bldDrawing`, `bldDrawBase`, `bldBadgeHits`, `LVL_ROOF`
- Fonctions : `bldZones`, `bldById`, `bldCur`, `bldRep`, `bldZoneAt`, `bldOfObj`, `bldActivate`, `bldMake`, `bldFig`, `bldMakeAsk`, `bldUnmake`, `etaClick`, `bldTagNew`, `bldPanelHTML`, `bldPanelDraw`, `bldLvlName`, `drawBldBadges`, `bldBadgeAt`, `bldOpen`, `bldPick`, `bldAll`, `bldSetZ`, `bldSetH`, `bldAdd`, `bldDelLvl`, `lvlSorted`, `lvlList`, `lvlName`, `lvlGuessZ`, `lvlInit`, `lvlRDC`, `lvlRel`, `lvlShiftObj`, `lvlChain`, `lvlCur`, `lvlOf`, `lvlRank`, `lvlHidden`, `lvlMine`, `lvlOff2D`, `lvlBelow`, `lvlTagNew`, `lvlMarkAll`, `lvlToggle`, `lvlRefresh`, `lvlPick`, `lvlAdd`, `lvlEdit`, `lvlSet`, `lvlUI`, `lvlPlace`, `lvlDelAsk`, `texApplySel`

## 36-blocs-ia.js

- **597 lignes**, 45 fonctions, 32 variables partagées
- Variables : `blkPending`, `tutoGhost`, `IA_MODELS`, `iaCfg`, `IA_PROV`, `iaProvSwitch`, `iaEsc`, `iaGuideCache`, `MC_SVG`, `mcMsgs`, `mcBusy`, `mcOpen`, `mcNews`, `mcPinned`, `mcSet`, `mcHist`, `mcAbort`, `mcSt`, `mcStopped`, `M2W`, `W2M`, `agNum`, `agR`, `P`, `NUM`, `STR`, `CAL`, `AG_TOOLS`, `agAllowSession`, `agImgs`, `agImgQueue`, `iaThinkKO`
- Fonctions : `blkSaveTabs`, `startBlockImport`, `blkBaseClick`, `drawTutoGhost`, `iaSetProvider`, `iaSave`, `iaFormRender`, `psIaRender`, `iaTest`, `iaReadSSE`, `iaErr`, `iaCall`, `iaGuide`, `iaSystem`, `iaPlan`, `mcHint`, `mcEl`, `mcRefresh`, `mcSettings`, `mcPin`, `mcToggle`, `mcClear`, `mcMd`, `mcRenderLog`, `mcActs`, `mcShowBtn`, `mcHistTrim`, `mcStatus`, `mcMini`, `mcStTick`, `mcSendBtn`, `mcStop`, `mcBtnUpd`, `mcSend`, `agLayer`, `agDescr`, `agRun`, `agImgSize`, `agImgPart`, `agExec`, `iaThink`, `iaGemFetch`, `iaGemini`, `iaSchema`, `iaClaude`

## 37-percer-dxf.js
_Percer / découper : une forme fermée évide un volume de part en part ----_

- **1011 lignes**, 46 fonctions, 14 variables partagées
- Variables : `pierceTarget`, `isClosed2D`, `ACI_PALETTE`, `DXF_LINEWEIGHTS`, `DXF_TPL_META`, `CP1252_EXTRA`, `TALUS_DXF_LAYER`, `dxfPaperPS`, `dxfLastUnit`, `unitName`, `dxfLayerPrefix`, `midClickT`, `midClickX`, `midClickY`
- Fonctions : `pierceRing`, `closedAt`, `prismTrisMM`, `pierceCSG`, `holesOf`, `xPtsOf`, `solidBaseZ`, `setMode`, `updateSelectedProperties`, `worldToMm`, `mmToWorld`, `layerDxfName`, `hexToRgb`, `rgbToHex`, `hexToAci`, `aciToHex`, `dashToDxf`, `dxfToDash`, `widthToLineweight`, `lineweightToWidth`, `dxfStr`, `cp1252Byte`, `objMetaFromDXF`, `platMetaFromDXF`, `fixLostAccents`, `isRichObj`, `dxfGeoMap`, `encodeCp1252`, `dxfDecode`, `exportDXF`, `_exportDXF`, `mmPerSquareUnit`, `dxfPresPayload`, `dxfPresApply`, `dxfExpand`, `dxfExtraMsg`, `dxfXrefMsg`, `dxfMText`, `importDXF`, `resolveImportLayer`, `zoomExtents`, `zoomToFitShapes`, `toggleFileMenu`, `closeFileMenus`, `mcDrawerBounds`, `exportDXFFile`

## 38-kmz-fichiers-securite.js
_KMZ / KML (Google Earth, Géoportail…) : points, lignes et polygones, un calque par dossier, projetés en Lambert 93 (ou la zone CC du plan)._

- **441 lignes**, 44 fonctions, 27 variables partagées
- Variables : `kmlCol`, `kmlXY`, `kmlKid`, `KML_PAL`, `fileHandle`, `fileName`, `savedRef`, `MMC_TYPE`, `DXF_TYPE`, `OPEN_TYPES`, `isDxfName`, `savedLp`, `AS_MAX`, `AS_EVERY`, `MC_INC`, `mcStamp`, `asGet`, `asSet`, `asDel`, `asBusy`, `asLastSig`, `asWhen`, `_lastTitle`, `baseName`, `MMC_FORMAT`, `MMC_MIGR`, `REF_MM_PER_PX`
- Fonctions : `zipEntries`, `kmlParse`, `kmlProj`, `kmlShapes`, `kmzRead`, `kmzOpen`, `kmzPlace`, `kmzToDXF`, `importKMZFile`, `importDXFFile`, `dxfText`, `dxfOverlayAsk`, `dxfOverlay`, `projectData`, `_projectData`, `fileBytes`, `lpSig`, `isDirty`, `markSaved`, `mcIncident`, `mcIncidentCopy`, `mcToast`, `asDB`, `asList`, `asClean`, `autosaveNow`, `asRestore`, `asBanner`, `autosaveInit`, `openAutosaves`, `asOpenAt`, `updateTitle`, `ensureExt`, `savedMsg`, `saveProject`, `openProject`, `openProjectFromInput`, `loadFileObject`, `mmcPrepare`, `loadProjectText`, `loadProjectData`, `getPrintRect`, `applyPrintScale`, `renderPrintCanvas`

## 39-impression-pdf.js

- **910 lignes**, 48 fonctions, 13 variables partagées
- Variables : `shapesHistory`, `historyStep`, `sync3DT`, `DESEL_MODES`, `SEC_PAT`, `DRAW_BAD`, `currentZs`, `pendingLogo`, `cropImg`, `cropBox`, `cropView`, `cropDrag`, `logoImg`
- Fonctions : `performPrint`, `layerTextH`, `annotTextPx`, `drawAnnotations`, `_drawFullPlanOnCtx`, `sync3D`, `deselAfterTool`, `saveState`, `undo`, `redo`, `copySelection`, `cutSelection`, `pasteSelection`, `isInstalledApp`, `refreshFullscreenBtn`, `toggleFullScreen`, `effectiveColor`, `ltTextOf`, `linePathPts`, `drawLineTexts`, `effectiveDash`, `effectiveWidth`, `layerHatchScaleOf`, `layerHatchScale`, `layerHatch`, `secGroundFill`, `drawHatch`, `drawMatHatch`, `drawSingleShape`, `drawSingleShape0`, `viewBoundsWorld`, `shapeOffView`, `drawFullPlan`, `drawOriginIcon`, `updateCursorCoords`, `startLogoCrop`, `clampCrop`, `drawCrop`, `cropPt`, `closeCrop`, `exportCrop`, `applyCrop`, `cropWhole`, `cartoucheRows`, `logoBox`, `getLogoImg`, `drawSheet`, `drawPreviewSheet`

## 40-mise-en-page.js

- **1102 lignes**, 97 fonctions, 51 variables partagées
- Variables : `LP_SCALES`, `lpDefaults`, `lpNew`, `layoutData`, `lpNoFill`, `layoutOn`, `lpCam`, `lpActiveId`, `lpSelId`, `lpSaved`, `lpInner`, `lpInkFlag`, `lpTyped`, `lpDrag`, `lpVpStart`, `lpVp`, `ICO_P`, `ICO`, `layouts`, `layoutIdx`, `lpHistById`, `lpName`, `LP_SETS`, `piDelAsk`, `lpMenuShown`, `LP_CART_OWN`, `lpCartEd`, `lpHov`, `lpSpace`, `lpModelStore`, `lpPaperHist`, `lpVpTin`, `lpTopoClosed`, `lpModelShapes`, `lpPaperShapes`, `lpToMm`, `lpRect`, `lpIsOrtho`, `lpIn`, `lpInV`, `lpIsImg`, `lpImgCache`, `lpScaleTxt`, `LP_BTNS`, `LP3D_IMG`, `lp3D`, `lpImgFrame`, `PdfCtx`, `lpDpi`, `FRAME_MEMO`, `NAV`
- Fonctions : `lpSync`, `lpResetAll`, `lpSwitch`, `lpAdd`, `lpAddSet`, `lpRemove`, `lpMove`, `lpTabsRender`, `lpRename`, `lpCartVal`, `lpThumb`, `lpMenuRender`, `lpMenuSet`, `lpMenuOpen`, `lpMenuClose`, `lpCartSrc`, `lpCartCells`, `lpCartCellAt`, `lpCartGet`, `lpCartSet`, `lpEndCartEdit`, `lpCartEdit`, `lpLogoPick`, `lpSetLogo`, `lpHandlePts`, `lpHandleAt`, `lpHandleCursor`, `lpDrawHandles`, `lpHover`, `lpUsePaper`, `lpUseModel`, `withModel`, `lpApplyPaperCam`, `lpFitView`, `lpTitlePt`, `lpPage`, `lpFit`, `lpVpAt`, `lpPath`, `lpArcText`, `lpImg`, `lpCamFor`, `lpApplyCam`, `lpSyncFromCam`, `polyCentroidW`, `lpVpVis`, `lpVpLayers`, `lpRenderVp`, `lpRenderPaper`, `lpCartouche`, `lpDrawSheet`, `lpSheetStart`, `lpSheetVp`, `lpSheetEnd`, `lpFolds`, `lpFoldMarks`, `drawLayout`, `toggleLayout`, `lpBtnRects`, `lpBtnRects0`, `lpDrawButtons`, `lpButtonAt`, `askText`, `lp3DImg`, `lp3DPrep`, `lp3DRender`, `lp3DSnap`, `lp3DEnter`, `lpPlace3D`, `lp3DLeave`, `lp3DSchedule`, `lp3DDown`, `lp3DMove`, `lp3DUp`, `lp3DWheel`, `lpButtonAction`, `lpImgLoad`, `lpCreateVp`, `lpSetScale`, `lpAskScale`, `lpWheel`, `lpMouseDown`, `lpEnterVp`, `lpLeaveVp`, `lpMouseMoveDrag`, `lpDblClick`, `pdfColor`, `lpBuildPDF`, `canvasToBW`, `lpBuildPDFAsync`, `lpPrintPDF`, `draw`, `navDraw`, `navBegin`, `drawFrame`, `updateCommandMessage`, `updatePropertiesPopup`

## 41-faconner-menus-demarrage.js

- **979 lignes**, 17 fonctions, 4 variables partagées
- Variables : `FACON_GAP`, `pcRingsOf`, `pcSnap`, `ENTER_KEEP`
- Fonctions : `faconPlats`, `faconOf`, `pcBand`, `faconZ`, `faconner`, `faconUndo`, `faconRedo`, `ctxItems`, `refoulEnds`, `refoulAt`, `refoulPanel`, `ctxClose`, `ctxOpen`, `typedDirFrom`, `validateTypedInput`, `selectAllShapes`, `resizeCanvas`
