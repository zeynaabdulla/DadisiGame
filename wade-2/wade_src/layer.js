function Layer(layerId, renderMode)
{
	this.id = layerId;

	this._sprites = [];
	this._spriteUidCounter = 0;
	this._movingSprites = [];
	this._transform = {scale: 1, translate: 1};
	this._sorting = 'none';
	this._dirtyAreas = [];
	this._needsFullRedraw = true;
	this._clearCanvas = true;
	this._smoothing = true;
	this._resolutionFactor = wade.getResolutionFactor();
	this._cameraPosition = wade.getCameraPosition();
	this._useQuadtree = true;
	this._opacity = 1;
	this._maxBatchSize = 256;
	this._minBatchSize = 4;
	this._batchSize = 0;
	this._spriteBatch = new Array(this._maxBatchSize);
	this._invisibleSprites = [];
	this._batchedBufferBound = false;
	this._batchingEnabled = true;
	this._postProcessUniforms = {};
	this._postProcessShaderProgram = null;
	this._customProperties = {};
	this._blur = 0;
	this._alwaysUpdateBlur = false;
	this._renderMode = renderMode || 'webgl';
	this._alphaBlendMode = ['SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'];
	this._colorBlendMode = ['ONE', 'ONE_MINUS_SRC_ALPHA'];
	if (this._renderMode == 'webgl' && !wade.isWebGlSupported())
	{
		this._renderMode = '2d';
		wade.log('WebGL is not supported in this environment, layer ' + layerId + ' is falling back to a canvas-based renderer.');
	}
	this._useOffScreenTarget = false;
	this._alwaysDrawSprites = [];
	this._updateScaleConversionFactor();

	// create float32 arrays for webgl rendering (if supported)
	try
	{
		this._f32ViewportSize = new Float32Array([0, 0]);
		this._f32CameraScaleTranslateTime = new Float32Array([0, 0, 0, 0]);
	}
	catch (e) {}
	// create primary canvas and get its context
	this.initCanvas();

	// set the world bounds to be the same as the screen size initially
	var halfWidth = wade.getScreenWidth() / 2;
	var halfHeight = wade.getScreenHeight() / 2;
	this._worldBounds = {minX: -halfWidth, minY: -halfHeight, maxX: halfWidth, maxY: halfHeight};

	// initialise the quad tree
	this._initQuadTree();
}

Layer.prototype.getScaleFactor = function()
{
	return this._transform.scale;
};

Layer.prototype.getTranslateFactor = function()
{
	return this._transform.translate;
};

Layer.prototype.setTransform = function(scale, translate)
{
	this._transform.scale = scale;
	this._transform.translate = translate;
	this._updateScaleConversionFactor();
	this._needsFullRedraw = true;
};

Layer.prototype.getSorting = function()
{
	return this._sorting;
};

Layer.prototype.setSorting = function(sorting)
{
	if (sorting != this._sorting)
	{
		this._sorting = sorting;
		switch(sorting)
		{
			case 'bottomToTop':
				this._sortingFunction = this._spriteSorter_bottomToTop;
				break;
			case 'topToBottom':
				this._sortingFunction = this._spriteSorter_topToBottom;
				break;
			case 'none':
				this._sortingFunction = 0;
				break;
			default:
				this._sortingFunction = sorting;
				break;
		}
		this._needsFullSorting = true;
	}
};

Layer.prototype.clearDirtyAreas = function()
{
	this._dirtyAreas.length = 0;
	this._needsFullRedraw = false;
};

Layer.prototype.addDirtyArea = function(area)
{
	this._dirtyAreas.push({minX: area.minX, maxX: area.maxX, minY: area.minY, maxY: area.maxY});
};

Layer.prototype.addAlwaysDrawSprite = function(sprite)
{
	this._alwaysDrawSprites.push(sprite);
};

Layer.prototype.removeAlwaysDrawSprite = function(sprite)
{
	wade.removeObjectFromArray(sprite, this._alwaysDrawSprites);
};

Layer.prototype.addSprite = function(sprite)
{
	// add the sprite to the array of sprites
	this._sprites.push(sprite);

	// generate and set an id for it
	sprite.id = ++this._spriteUidCounter;

	// update world bounds
	wade.expandBox(this._worldBounds, sprite.boundingBox);

	// add the sprite to the quad tree
	if (this._useQuadtree)
	{
		// mark the area occupied by the new sprite as dirty
		this.addDirtyArea(sprite.boundingBox);
		this._addSpriteToQuadTree(sprite);
	}

	// check if it's an always-draw sprite
	if (sprite.isAlwaysDrawing())
	{
		this.addAlwaysDrawSprite(sprite);
	}

	// we need to do a full sort the next time we draw
	// insertion sort is probably faster but complicated as we may be inserting multiple sprites out of order in one step
	this._needsFullSorting = true;
};

Layer.prototype.getSpriteCount = function()
{
	return this._sprites.length + this._alwaysDrawSprites.length;
};

Layer.prototype.getSprites = function()
{
	return this._sprites.concat(this._alwaysDrawSprites);
};

Layer.prototype.removeSprite = function(sprite)
{
	wade.removeObjectFromArray(sprite, this._sprites);
	if (this._useQuadtree && sprite.quadTreeNode)
	{
		this.addDirtyArea(sprite.boundingBox);
		sprite.quadTreeNode.removeObject(sprite);
		sprite.quadTreeNode = 0;
	}
	if (sprite.isAlwaysDrawing())
	{
		this.removeAlwaysDrawSprite(sprite);
	}
};

Layer.prototype.hasAnythingChanged = function()
{
	return !(this._dirtyAreas.length == 0 && !this._needsFullRedraw && this._useQuadtree && !this._alwaysDrawSprites.length);
};

Layer.prototype.draw = function(forceRedraw)
{
	var i, j, k;

	// no canvas, no draw
	if (!this._canvas)
	{
		return;
	}

	// don't do anything if nothing has changed in this layer
	if (!forceRedraw && !this.hasAnythingChanged())
	{
		// unless we are using a shared canvas
		if (!wade.isSharedCanvas(this._canvas))
		{
			return;
		}

		// if we are on a shared canvas, we still need to draw our render target (if we have an off screen render target, otherwise we need a full draw)
		if (this._useOffScreenTarget)
		{
			this.clearDirtyAreas();
			(this._renderMode == 'webgl') && this.drawRenderTargetToScreen();
			return;
		}
	}

	// in webgl mode, we always need a full redraw unless we are using an off screen render target
	if (!this._useOffScreenTarget && this._renderMode == 'webgl')
	{
		this._needsFullRedraw = true;
	}

	// if the render mode is set to webgl, make sure we can support it, or fall back to 2d canvas
	if (this._renderMode == 'webgl' && !wade.isWebGlSupported())
	{
		this._renderMode = '2d';
	}

	// choose a context
	var context = this._context;

	// precalculate some useful variables
	var canvasWidth = wade.getScreenWidth() * this._resolutionFactor;
	var canvasHeight = wade.getScreenHeight() * this._resolutionFactor;
	var halfCanvasWidth = canvasWidth /  2;
	var halfCanvasHeight = canvasHeight / 2;

	// sort the sprites
	if (this._sorting != 'none')
	{
		// if the number of moving sprites if greater than the square root of the total sprites, we need a full sort
		// this is because the sorting algorithm below that sorts moving sprites individually is O(N^2), the full sort is presumably O(N*logN)
		this._needsFullSorting = this._needsFullSorting || this._movingSprites.length * this._movingSprites.length > this._sprites.length;
		if (this._needsFullSorting)
		{
			this._sprites.sort(this._sortingFunction);
		}
		else
		{
			for (i=0; i<this._movingSprites.length; i++)
			{
				var numSwaps = 0;
				var movingSprite = this._movingSprites[i];
				for (j=0; j<this._sprites.length; j++)
				{
					if (movingSprite == this._sprites[j])
					{
						break;
					}
				}
				if (j < this._sprites.length)
				{
					for (k=j+1; k<this._sprites.length; k++)
					{
						if (this._sortingFunction(movingSprite, this._sprites[k]) > 0)
						{
							this._sprites[k].setDirtyArea();
							this._sprites[k-1] = this._sprites[k];
							this._sprites[k] = movingSprite;
							numSwaps++;
						}
						else
						{
							break;
						}
					}
					if (!numSwaps)
					{
						for (k=j-1; k>=0; k--)
						{
							if (this._sortingFunction(movingSprite, this._sprites[k]) < 0)
							{
								this._sprites[k].setDirtyArea();
								this._sprites[k+1] = this._sprites[k];
								this._sprites[k] = movingSprite;
								numSwaps++;
							}
							else
							{
								break;
							}
						}
					}
				}
			}
		}
	}
	this._needsFullSorting = false;

	// reset the array of moving sprites
	this._movingSprites.length = 0;

	// if in webgl mode, set a framebuffer to render to
	if (this._renderMode == 'webgl')
	{
		context.bindFramebuffer(context.FRAMEBUFFER, (this._useOffScreenTarget? this._mainRenderTarget : null));
		context.uniform2fv(context.currentShader.uniforms['uViewportSize'], this._f32ViewportSize);
		context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
	}

	// are we using a quadtree for this layer?
	if (this._useQuadtree) {
		// if the layer needs a full redraw, update the transform on the context object
		var dirtyArea;
		var canvasInWorldSpace = this.canvasBoxToWorld({
			minX: -halfCanvasWidth,
			minY: -halfCanvasHeight,
			maxX: halfCanvasWidth,
			maxY: halfCanvasHeight
		});
		if (this._needsFullRedraw) {
			// calculate camera transform
			var s = this._scaleConversionFactor;
			var tx = halfCanvasWidth - this._cameraPosition.x * this._transform.translate * s;
			var ty = halfCanvasHeight - this._cameraPosition.y * this._transform.translate * s;

			if (this._renderMode == '2d') {
				// restore context
				context.restore();

				// save context
				context.save();

				// set camera transform
				context.setTransform(s, 0, 0, s, Math.round(tx), Math.round(ty));
			}
			else if (this._renderMode == 'webgl') {
				// set camera transform
				this._f32CameraScaleTranslateTime[0] = s;
				this._f32CameraScaleTranslateTime[1] = this._cameraPosition.x * this._transform.translate * s;
				this._f32CameraScaleTranslateTime[2] = this._cameraPosition.y * this._transform.translate * s;
				this._f32CameraScaleTranslateTime[3] = wade.getAppTime();
				context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
			}

			// set the dirty area to be the whole world-space area occupied by the canvas
			dirtyArea = wade.cloneObject(canvasInWorldSpace);
		}
		else {
			// calculate the area that needs redrawing
			dirtyArea = this._joinDirtyAreas();
		}

		// don't do anything if the dirty area doesn't exist (it can happen if it's off-screen or zero-sized)
		if (!dirtyArea)
		{
			this.clearDirtyAreas();
			(this._renderMode == 'webgl') && this._useOffScreenTarget && this.drawRenderTargetToScreen();
			return;
		}

		// clear the 'needsDrawing' flag on each sprite
		for (k = 0; k < this._sprites.length; k++) {
			this._sprites[k].needsDrawing = 0;
		}

		var oldArea = 0;
		while (oldArea.minX != dirtyArea.minX || oldArea.minY != dirtyArea.minY || oldArea.maxX != dirtyArea.maxX || oldArea.maxY != dirtyArea.maxY) {
			// make sure the coordinates of the dirty area are valid, or we'll be stuck in this loop forever
			if (isNaN(dirtyArea.minX) || isNaN(dirtyArea.minY) || isNaN(dirtyArea.maxX) || isNaN(dirtyArea.maxY)) {
				// output some debugging information if anything went wrong
				wade.warn("Warning: it isn't possible to render this frame");
				var cameraPos = wade.getCameraPosition();
				if (isNaN(cameraPos.x) || isNaN(cameraPos.y) || isNaN(cameraPos.z)) {
					wade.warn('*** Invalid camera coodinates: ' + cameraPos.x + ', ' + cameraPos.y + ', ' + cameraPos.z);
				}
				for (k = 0; k < this._sprites.length; k++) {
					var pos = this._sprites[k].getPosition();
					var size = this._sprites[k].getSize();
					var posIsNaN = isNaN(pos.x) || isNaN(pos.y);
					var sizeIsNaN = isNaN(size.x) || isNaN(size.y);
					if (posIsNaN || sizeIsNaN) {
						var parent = this._sprites[k].getSceneObject();
						var parentName = parent && parent.getName() || '';
						var spriteName = this._sprites[k].getName();
						if (!spriteName) {
							if (parent) {
								for (var l = 0; l < parent.getSpriteCount(); l++) {
									if (parent.getSprite(l) == this._sprites[k]) {
										spriteName = 'Sprite' + l;
										break;
									}
								}
							}
							else {
								spriteName = 'Unnamed Sprite';
							}
						}
						var name = (parentName ? parentName + '.' : '') + spriteName;
						if (posIsNaN) {
							wade.warn('*** ' + name + ' has an invalid position: ' + pos.x + ', ' + pos.y);
						}
						if (sizeIsNaN) {
							wade.warn('*** ' + name + ' has an invalid size: ' + size.x + ', ' + size.y);
						}
					}
				}
				return;
			}

			// ask the quadtree to flag the sprites that need drawing
			this._quadTree.flagObjects(dirtyArea, 'needsDrawing');

			// if this isn't a full redraw, we need to expand the dirty area to include all overlapping sprites (and sprites overlapping the overlapping sprites, etc.)
			oldArea = wade.cloneObject(dirtyArea);
			for (j = 0; j < this._sprites.length; j++) {
				if ((this._sprites[j].needsDrawing || this._sprites[j].isAlwaysDrawing) && this._sprites[j].isVisible()) {
					wade.expandBox(dirtyArea, this._sprites[j].boundingBox);
				}
			}
			wade.clampBoxToBox(dirtyArea, canvasInWorldSpace);
		}

		// clear the dirty area of the canvas
		if (this._clearCanvas) {
			var canvasArea;
			if (this._renderMode == '2d') {
				context.save();
				context.setTransform(1, 0, 0, 1, 0, 0);
				if (this._needsFullRedraw) {
					context.clearRect(0, 0, Math.round(canvasWidth), Math.round(canvasHeight));
				}
				else {
					// calculate a bounding box of all the sprites that need drawing and clear it
					canvasArea = this.worldBoxToCanvas(dirtyArea);
					context.clearRect(Math.floor(canvasArea.minX + halfCanvasWidth - 1), Math.floor(canvasArea.minY + halfCanvasHeight - 1), Math.ceil(canvasArea.maxX - canvasArea.minX + 2), Math.ceil(canvasArea.maxY - canvasArea.minY + 2));
				}
				context.restore();
			}
			else if (this._renderMode == 'webgl') {
				if (this._needsFullRedraw) {
					context.clear(context.COLOR_BUFFER_BIT);
				}
				else {
					// calculate a bounding box of all the sprites that need drawing and clear it
					canvasArea = this.worldBoxToCanvas(dirtyArea);
					context.enable(context.SCISSOR_TEST);
					context.scissor(Math.floor(canvasArea.minX + halfCanvasWidth - 1), canvasHeight - Math.floor(canvasArea.minY + halfCanvasHeight - 1) - Math.ceil(canvasArea.maxY - canvasArea.minY + 2), Math.ceil(canvasArea.maxX - canvasArea.minX + 2), Math.ceil(canvasArea.maxY - canvasArea.minY + 2));
					context.clear(context.COLOR_BUFFER_BIT);
					context.disable(context.SCISSOR_TEST);
				}
			}
		}

		// remove dirty areas
		this.clearDirtyAreas();

		// use css to control opacity of 2d layers
		if (this._renderMode == '2d')
		{
			if (this._canvas.style.opacity != this._opacity)
			{
				this._canvas.style.opacity = this._opacity;
			}
		}
		else
		{
			if (this._canvas.style.opacity != 1)
			{
				this._canvas.style.opacity = 1;
			}
		}

		// draw the sprites that need drawing
		this._drawSprites(true);
	}
	else // no quadtree, just draw everything
	{
		// calculate camera transform
		s = this._scaleConversionFactor;
		tx = halfCanvasWidth - this._cameraPosition.x * this._transform.translate * s;
		ty = halfCanvasHeight - this._cameraPosition.y * this._transform.translate * s;

		if (this._renderMode == 'webgl')
		{
			// clear
			if (this._hasOwnCanvas)
			{
				context.clear(context.COLOR_BUFFER_BIT);
			}

			// set camera transform
			this._f32CameraScaleTranslateTime[0] = s;
			this._f32CameraScaleTranslateTime[1] = this._cameraPosition.x * this._transform.translate * s;
			this._f32CameraScaleTranslateTime[2] = this._cameraPosition.y * this._transform.translate * s;
			context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
		}
		else if (this._renderMode == '2d')
		{
			// clear
			context.save();
			context.setTransform(1,0,0,1,0,0);
			context.clearRect(0, 0, Math.round(canvasWidth), Math.round(canvasHeight));
			context.restore();

			// set camera transform
			context.setTransform(s, 0, 0, s, Math.round(tx), Math.round(ty));
		}

		// remove dirty areas
		this.clearDirtyAreas();

		if (this._renderMode == '2d' && this._canvas.style.opacity != this._opacity)
		{
			this._canvas.style.opacity = this._opacity;
		}
		this._drawSprites();
	}

	// if we are in webgl mode, do a post-render step for some post-processing and to draw the framebuffer onto the screen
	if (this._renderMode == 'webgl' && this._useOffScreenTarget)
	{
		this.drawRenderTargetToScreen();
	}
};

Layer.prototype._drawBatch = function()
{
	var i;
	var context = this._context;

	// if we have very few sprites in the batch, just draw them individually as batching is likely to be slower
	if (this._batchSize < this._minBatchSize)
	{
		this._bindSingleSpriteVertexBuffer();
		for (i=0; i<this._batchSize; i++)
		{
			this._spriteBatch[i].draw(context);
		}
		return;
	}

	// tell visible sprites to update buffer data
	wade.numDrawCalls++;
	for (i=0; i<this._batchSize; i++)
	{
		this._spriteBatch[i].draw.batched.call(this._spriteBatch[i], context, i);
	}

	// set texture
	context.setTextureImage(this._spriteBatch[0].getImageUsedInDraw());

	// set buffer data
	this._bindBatchedSpriteVertexBuffer();
	context.bufferSubData(context.ARRAY_BUFFER, 0, context.batchedVertices);

	// draw
	this.setShaderProgram(context.batchedShaderProgram);
	context.drawElements(context.TRIANGLES, 6 * this._batchSize, context.UNSIGNED_SHORT, 0);
};

Layer.prototype._processSpriteForBatching = function(sprite)
{
	if (!sprite.isVisible())
	{
		this._invisibleSprites.push(sprite);
		return;
	}
	var context = this._context;
	var imageUsedInDraw = sprite.getImageUsedInDraw();
	var usingDefaultGlDraw = sprite.isUsingBatchableDraw();
	var notADifferentImage = (!this._lastImageUsedInBatch || this._lastImageUsedInBatch == imageUsedInDraw);
	if (usingDefaultGlDraw && notADifferentImage && this._batchSize < this._maxBatchSize)
	{
		this._spriteBatch[this._batchSize++] = sprite;
		this._lastImageUsedInBatch = imageUsedInDraw;
	}
	else
	{
		// draw batch
		this._drawBatch();

		// add the sprite to a new batch - or not, if it's using its own custom shader
		this._batchSize = 0;
		this._lastImageUsedInBatch = null;
		if (!usingDefaultGlDraw)
		{
			this._bindSingleSpriteVertexBuffer();
			sprite.draw(context);
		}
		else
		{
			this._lastImageUsedInBatch = imageUsedInDraw;
			this._spriteBatch[this._batchSize++] = sprite;
		}
	}
};

Layer.prototype._drawSpritesWithBatching = function(checkFlags)
{
	var i, sprite;
	this._lastImageUsedInBatch = null;
	this._invisibleSprites.length = 0;
	this._batchSize = 0;
	if (checkFlags)
	{
		for (i=0; i<this._sprites.length; i++)
		{
			sprite = this._sprites[i];
			if (sprite.needsDrawing || sprite.isAlwaysDrawing())
			{
				this._processSpriteForBatching(sprite);
			}
		}
	}
	else
	{
		for (i=0; i<this._sprites.length; i++)
		{
			sprite = this._sprites[i];
			this._processSpriteForBatching(sprite);
		}
	}
	this._drawBatch();
	this._lastImageUsedInBatch = null;
	for (i=0; i<this._invisibleSprites.length; i++)
	{
		this._context.setTextureImage(this._invisibleSprites[i].getImageUsedInDraw(), true);
	}
	this._bindSingleSpriteVertexBuffer();
};

Layer.prototype._drawSprites = function(checkFlags)
{
	if (this._batchingEnabled && this._renderMode == 'webgl')
	{
		return this._drawSpritesWithBatching(checkFlags);
	}
	var context = this._context;
	if (checkFlags)
	{
		for (var i=0; i<this._sprites.length; i++)
		{
			var sprite = this._sprites[i];
			if (sprite.needsDrawing || sprite.isAlwaysDrawing())
			{
				sprite.draw(context);
			}
		}
	}
	else
	{
		for (i=0; i<this._sprites.length; i++)
		{
			this._sprites[i].draw(context);
		}
	}
};

Layer.prototype._updateBlurRenderTarget = function()
{
	// downsample
	var context = this._context;
	var qw = this._quarterSizeRenderTarget.uniformValues.positionAndSize[2];
	var qh = this._quarterSizeRenderTarget.uniformValues.positionAndSize[3];
	this.setShaderProgram(context.defaultShaderProgram);
	context.uniform2fv(context.currentShader.uniforms['uViewportSize'], new Float32Array([qw, qh]));
	context.viewport(0, 0, qw, qh);
	context.blendFuncSeparate(context.ONE, context.ONE_MINUS_SRC_ALPHA, context.ONE, context.ONE_MINUS_SRC_ALPHA);
	this._f32CameraScaleTranslateTime[0] = 1;
	this._f32CameraScaleTranslateTime[1] = 0;
	this._f32CameraScaleTranslateTime[2] = 0;
	this._f32CameraScaleTranslateTime[3] = wade.getAppTime();
	context.bindFramebuffer(context.FRAMEBUFFER, this._quarterSizeRenderTarget);
	context.clear(context.COLOR_BUFFER_BIT);
	context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
	context.uniform4fv(context.currentShader.uniforms['uPositionAndSize'], this._quarterSizeRenderTarget.uniformValues.positionAndSize);
	context.uniform4fv(context.currentShader.uniforms['uAnimFrameInfo'], this._mainRenderTarget.uniformValues.animFrameInfo);
	context.uniform4fv(context.currentShader.uniforms['uImageArea'], this._mainRenderTarget.uniformValues.imageArea);
	context.uniform2fv(context.currentShader.uniforms['uRotationAlpha'], this._mainRenderTarget.uniformValues.rotationAlpha);
	context.bindTexture(context.TEXTURE_2D, this._mainRenderTarget.texture);
	context.drawArrays(context.TRIANGLE_STRIP, 0, 4);

	// horizontal blur
	this.setShaderProgram(context.blurShaderProgram);
	context.uniform2fv(context.currentShader.uniforms['uViewportSize'], new Float32Array([qw, qh]));
	context.uniform2fv(context.currentShader.uniforms['uDelta'], new Float32Array([1.5/qw, 0]));
	context.bindFramebuffer(context.FRAMEBUFFER, this._blurRenderTargetH);
	context.clear(context.COLOR_BUFFER_BIT);
	context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
	context.uniform4fv(context.currentShader.uniforms['uPositionAndSize'], this._quarterSizeRenderTarget.uniformValues.positionAndSize);
	context.uniform4fv(context.currentShader.uniforms['uAnimFrameInfo'], this._mainRenderTarget.uniformValues.animFrameInfo);
	context.uniform4fv(context.currentShader.uniforms['uImageArea'], this._mainRenderTarget.uniformValues.imageArea);
	context.uniform2fv(context.currentShader.uniforms['uRotationAlpha'], this._mainRenderTarget.uniformValues.rotationAlpha);
	context.bindTexture(context.TEXTURE_2D, this._quarterSizeRenderTarget.texture);
	context.drawArrays(context.TRIANGLE_STRIP, 0, 4);

	// vertical blur
	context.uniform2fv(context.currentShader.uniforms['uDelta'], new Float32Array([0, 1.5/qh]));
	context.bindFramebuffer(context.FRAMEBUFFER, this._blurRenderTargetHV);
	context.clear(context.COLOR_BUFFER_BIT);
	context.bindTexture(context.TEXTURE_2D, this._blurRenderTargetH.texture);
	context.drawArrays(context.TRIANGLE_STRIP, 0, 4);

	// restore viewport to full size
	context.uniform2fv(context.currentShader.uniforms['uViewportSize'], this._f32ViewportSize);
	context.viewport(0, 0, this._f32ViewportSize[0], this._f32ViewportSize[1]);
};

Layer.prototype.drawRenderTargetToScreen = function()
{
	var context = this._context;
	if (this._blur)
	{
		this._updateBlurRenderTarget();
		this.setShaderProgram(context.blendShaderProgram);
		context.activeTexture(context.TEXTURE1);
		context.setTextureImage({imageName: '_layerBlur_' + this.id}, false, 1);
		context.uniform1i(context.blendShaderProgram.uniforms.uOtherSampler, 1);
		context.uniform1f(context.currentShader.uniforms['uBlendFactor'], this._blur);
		context.activeTexture(context.TEXTURE0);
	}
	else
	{
		if (this._alwaysUpdateBlur)
		{
			this._updateBlurRenderTarget();
		}
	}
    if (this._postProcessShaderProgram && this._postProcessShaderProgram != context.defaultShaderProgram)
    {
        this.setShaderProgram(this._postProcessShaderProgram);
    }
    else if (this._opacity != 1)
    {
        this.setShaderProgram(context.compositeShaderProgram);
    }
    else
    {
        this.setShaderProgram(context.defaultShaderProgram);
    }
	context.blendFuncSeparate(context[this._colorBlendMode[0]], context[this._colorBlendMode[1]], context[this._alphaBlendMode[0]], context[this._alphaBlendMode[1]]);
	this._f32CameraScaleTranslateTime[0] = 1;
	this._f32CameraScaleTranslateTime[1] = 0;
	this._f32CameraScaleTranslateTime[2] = 0;
	this._f32CameraScaleTranslateTime[3] = wade.getAppTime();
	context.bindFramebuffer(context.FRAMEBUFFER, null);
	if (this._hasOwnCanvas)
	{
		context.clear(context.COLOR_BUFFER_BIT);
	}
	context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
	context.uniform4fv(context.currentShader.uniforms['uPositionAndSize'], this._mainRenderTarget.uniformValues.positionAndSize);
	context.uniform4fv(context.currentShader.uniforms['uAnimFrameInfo'], this._mainRenderTarget.uniformValues.animFrameInfo);
	context.uniform4fv(context.currentShader.uniforms['uImageArea'], this._mainRenderTarget.uniformValues.imageArea);
	context.uniform2fv(context.currentShader.uniforms['uRotationAlpha'], this._mainRenderTarget.uniformValues.rotationAlpha);
	context.bindTexture(context.TEXTURE_2D, this._mainRenderTarget.texture);
	// set custom shader uniforms for the post-process pass
	if (this._postProcessUniforms)
	{
		var numTextures = 1;
		var uniformTypeNames = Sprite.prototype.uniformTypeNames;
		for (var u in this._postProcessUniforms)
		{
			var uniformTypeName = this._postProcessUniforms[u];
			var f = uniformTypeNames[uniformTypeName];
			if (f)
			{
				if (this._typedPostProcessUniforms && this._typedPostProcessUniforms[u])
				{
					for (var i=0; i<this._typedPostProcessUniforms[u].length; i++)
					{
						this._typedPostProcessUniforms[u][i] = this._customProperties[u] && this._customProperties[u][i] || 0;
					}
					context[f](this._postProcessShaderProgram.uniforms[u], this._typedPostProcessUniforms[u]);
				}
				else
				{
					context[f](this._postProcessShaderProgram.uniforms[u], this._customProperties[u]);
				}
			}
			else if (uniformTypeName == 'sampler2D')
			{
				context.activeTexture(context.TEXTURE0 + numTextures);
				context.uniform1i(this._postProcessShaderProgram.uniforms[u], numTextures);
				var image = context.textures[this._customProperties[u]]? {imageName: this._customProperties[u]} : wade.getImage(wade.getFullPathAndFileName(this._customProperties[u]));
				context.setTextureImage(image, false, numTextures);
				numTextures++;
				context.activeTexture(context.TEXTURE0);
			}
		}
	}
	// draw the quad
	context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
	var s = this._scaleConversionFactor;
	this._f32CameraScaleTranslateTime[0] = s;
	this._f32CameraScaleTranslateTime[1] = this._cameraPosition.x * this._transform.translate * s;
	this._f32CameraScaleTranslateTime[2] = this._cameraPosition.y * this._transform.translate * s;
	context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
	context.bindTexture(context.TEXTURE_2D, null);
	context.currentImage[0] = null;
	context.blendFuncSeparate(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA, context.ONE, context.ONE_MINUS_SRC_ALPHA);
};

Layer.prototype.sort = function(sortingFunction)
{
	this._sprites.sort(sortingFunction || this._sortingFunction);
	this._needsFullRedraw = true;
};

Layer.prototype.onCameraPositionChanged = function(cameraPosition)
{
	// force a full redraw if the camera x or y has changed and we have a non-zero translate factor, or z has changed and we have a non-zero scale factor
	if ((this._transform.translate != 0 &&  (cameraPosition.x != this._cameraPosition.x || cameraPosition.y != this._cameraPosition.y)) ||
		(this._transform.scale != 0 && cameraPosition.z != this._cameraPosition.z))
	{
		this._needsFullRedraw = true;
	}
	// update camera values
	this._cameraPosition = {x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z};
	this._updateScaleConversionFactor();
};

Layer.prototype.setColorBlendMode = function(blendSrc, blendDest)
{
    this._colorBlendMode[0] = blendSrc;
    this._colorBlendMode[1] = blendDest;
};

Layer.prototype.setAlphaBlendMode = function(blendSrc, blendDest)
{
    this._alphaBlendMode[0] = blendSrc;
    this._alphaBlendMode[1] = blendDest;
};

Layer.prototype.onSpritePositionChanged = function(sprite)
{
	// update the quadtree
	if (this._useQuadtree && sprite.quadTreeNode)
	{
		wade.expandBox(this._worldBounds, sprite.boundingBox);
		sprite.quadTreeNode.removeObject(sprite);
		this._addSpriteToQuadTree(sprite);
	}
	this._movingSprites.push(sprite);
};

Layer.prototype.worldPositionToScreen = function(position)
{
	return {x: this._scaleConversionFactor * (position.x  - this._cameraPosition.x * this._transform.translate) / this._resolutionFactor,
		y: this._scaleConversionFactor * (position.y  - this._cameraPosition.y * this._transform.translate) / this._resolutionFactor};
};

Layer.prototype.worldDirectionToScreen = function(direction)
{
	return {x: this._scaleConversionFactor * direction.x / this._resolutionFactor,
		y: this._scaleConversionFactor * direction.y / this._resolutionFactor};
};

Layer.prototype.worldBoxToScreen = function(box)
{
	var worldHalfSize = {x: (box.maxX - box.minX) / 2, y: (box.maxY - box.minY) / 2};
	var worldPosition = {x: box.minX + worldHalfSize.x, y: box.minY + worldHalfSize.y};
	var screenPosition = this.worldPositionToScreen(worldPosition);
	var screenHalfSize = this.worldDirectionToScreen(worldHalfSize);
	return {minX: screenPosition.x - screenHalfSize.x,
		minY: screenPosition.y - screenHalfSize.y,
		maxX: screenPosition.x + screenHalfSize.x,
		maxY: screenPosition.y + screenHalfSize.y};
};

Layer.prototype.worldUnitToScreen = function()
{
	return this._scaleConversionFactor / this._resolutionFactor;
};

Layer.prototype.screenPositionToWorld = function(screenPosition)
{
	return {x: this._cameraPosition.x * this._transform.translate + screenPosition.x * this._resolutionFactor / this._scaleConversionFactor,
		y: this._cameraPosition.y * this._transform.translate + screenPosition.y * this._resolutionFactor / this._scaleConversionFactor};
};

Layer.prototype.screenDirectionToWorld = function(screenDirection)
{
	return {x: screenDirection.x * this._resolutionFactor / this._scaleConversionFactor,
		y: screenDirection.y * this._resolutionFactor / this._scaleConversionFactor};
};

Layer.prototype.screenBoxToWorld = function(box)
{
	var screenHalfSize = {x: (box.maxX - box.minX) / 2, y: (box.maxY - box.minY) / 2};
	var screenPosition = {x: box.minX + screenHalfSize.x, y: box.minY + screenHalfSize.y};
	var worldPosition = this.screenPositionToWorld(screenPosition);
	var worldHalfSize = this.screenDirectionToWorld(screenHalfSize);
	return {minX: worldPosition.x - worldHalfSize.x,
		minY: worldPosition.y - worldHalfSize.y,
		maxX: worldPosition.x + worldHalfSize.x,
		maxY: worldPosition.y + worldHalfSize.y};
};

Layer.prototype.screenUnitToWorld = function()
{
	return this._resolutionFactor / this._scaleConversionFactor;
};

Layer.prototype.worldPositionToCanvas = function(position)
{
	return {x: this._scaleConversionFactor * (position.x  - this._cameraPosition.x * this._transform.translate),
		y: this._scaleConversionFactor * (position.y  - this._cameraPosition.y * this._transform.translate)};
};

Layer.prototype.worldDirectionToCanvas = function(direction)
{
	return {x: this._scaleConversionFactor * direction.x,
		y: this._scaleConversionFactor * direction.y};
};

Layer.prototype.worldBoxToCanvas = function(box)
{
	var worldHalfSize = {x: (box.maxX - box.minX) / 2, y: (box.maxY - box.minY) / 2};
	var worldPosition = {x: box.minX + worldHalfSize.x, y: box.minY + worldHalfSize.y};
	var canvasPosition = this.worldPositionToCanvas(worldPosition);
	var canvasHalfSize = this.worldDirectionToCanvas(worldHalfSize);
	return {minX: canvasPosition.x - canvasHalfSize.x,
		minY: canvasPosition.y - canvasHalfSize.y,
		maxX: canvasPosition.x + canvasHalfSize.x,
		maxY: canvasPosition.y + canvasHalfSize.y};
};

Layer.prototype.worldUnitToCanvas = function()
{
	return this._scaleConversionFactor;
};

Layer.prototype.canvasPositionToWorld = function(canvasPosition)
{
	return {x: this._cameraPosition.x * this._transform.translate + canvasPosition.x / this._scaleConversionFactor,
		y: this._cameraPosition.y * this._transform.translate + canvasPosition.y / this._scaleConversionFactor};
};

Layer.prototype.canvasDirectionToWorld = function(canvasDirection)
{
	return {x: canvasDirection.x / this._scaleConversionFactor,
		y: canvasDirection.y / this._scaleConversionFactor};
};

Layer.prototype.canvasBoxToWorld = function(box)
{
	var canvasHalfSize = {x: (box.maxX - box.minX) / 2, y: (box.maxY - box.minY) / 2};
	var canvasPosition = {x: box.minX + canvasHalfSize.x, y: box.minY + canvasHalfSize.y};
	var worldPosition = this.canvasPositionToWorld(canvasPosition);
	var worldHalfSize = this.canvasDirectionToWorld(canvasHalfSize);
	return {minX: worldPosition.x - worldHalfSize.x,
		minY: worldPosition.y - worldHalfSize.y,
		maxX: worldPosition.x + worldHalfSize.x,
		maxY: worldPosition.y + worldHalfSize.y};
};

Layer.prototype.canvasUnitToWorld = function()
{
	return 1 / this._scaleConversionFactor;
};

Layer.prototype.resize = function(screenWidth, screenHeight)
{
	if (this._canvas)
	{
		if (this._renderMode != 'webgl' || this._hasOwnCanvas)
		{
			this._canvas.width = Math.round(screenWidth * this._resolutionFactor);
			this._canvas.height = Math.round(screenHeight * this._resolutionFactor);
		}
		if (this._renderMode == 'webgl')
		{
			var width = this._canvas.width;
			var height = this._canvas.height;
			var qw = Math.floor(width / 4);
			var qh = Math.floor(height / 4);
			this._f32ViewportSize[0] = width;
			this._f32ViewportSize[1] = height;
			this._mainRenderTarget.uniformValues.positionAndSize[2] = width;
			this._mainRenderTarget.uniformValues.positionAndSize[3] = height;
			this._quarterSizeRenderTarget.uniformValues.positionAndSize[2] = qw;
			this._quarterSizeRenderTarget.uniformValues.positionAndSize[3] = qh;
			if (this._hasOwnCanvas)
			{
				this._context.viewport(0, 0, width, height);
				this._context.uniform2fv(this._context.currentShader.uniforms['uViewportSize'], this._f32ViewportSize);
				this._context.currentImage = [];
			}
			this._context.bindTexture(this._context.TEXTURE_2D, this._mainRenderTarget.texture);
			this._context.texImage2D(this._context.TEXTURE_2D, 0, this._context.RGBA, width, height, 0, this._context.RGBA, this._context.UNSIGNED_BYTE, null);
			this._context.bindTexture(this._context.TEXTURE_2D, this._quarterSizeRenderTarget.texture);
			this._context.texImage2D(this._context.TEXTURE_2D, 0, this._context.RGBA, qw, qh, 0, this._context.RGBA, this._context.UNSIGNED_BYTE, null);
			this._context.bindTexture(this._context.TEXTURE_2D, this._blurRenderTargetH.texture);
			this._context.texImage2D(this._context.TEXTURE_2D, 0, this._context.RGBA, qw, qh, 0, this._context.RGBA, this._context.UNSIGNED_BYTE, null);
			this._context.bindTexture(this._context.TEXTURE_2D, this._blurRenderTargetHV.texture);
			this._context.texImage2D(this._context.TEXTURE_2D, 0, this._context.RGBA, qw, qh, 0, this._context.RGBA, this._context.UNSIGNED_BYTE, null);
			this._context.bindTexture(this._context.TEXTURE_2D, null);
		}
	}
	this._needsFullRedraw = true;

	// context properties will be lost at this point, so if we had smoothing disabled, re-disable it
	if (!this._smoothing)
	{
		this._smoothing = true;
		this.setSmoothing(false);
	}
};

Layer.prototype.setCanvasClearing = function(toggle)
{
	this._clearCanvas = toggle;
};

Layer.prototype.getContext = function()
{
	return this._context;
};

Layer.prototype.bringSpriteToFront = function(sprite)
{
	sprite.setDirtyArea();
	wade.removeObjectFromArray(sprite, this._sprites);
	this._sprites.push(sprite);
};

Layer.prototype.pushSpriteToBack = function(sprite)
{
	sprite.setDirtyArea();
	wade.removeObjectFromArray(sprite, this._sprites);
	this._sprites.splice(0, 0, sprite);
};

Layer.prototype.putSpriteBehindSprite = function(sprite, otherSprite)
{
	var index = this._sprites.indexOf(otherSprite);
	wade.removeObjectFromArray(sprite, this._sprites);
	this._sprites.splice(index, 0, sprite);
};

Layer.prototype.setCanvasStyleSize = function(width, height)
{
	if (!this._canvas)
	{
		return;
	}
	if (width != this._canvas.style.width || height != this._canvas.style.height)
	{
		this._canvas.style.width = width;
		this._canvas.style.height = height;
	}
};

Layer.prototype.compareSprites = function(spriteA, spriteB)
{
	if (this._sortingFunction)
	{
		return this._sortingFunction(spriteA, spriteB);
	}
	else
	{
		return this._sprites.indexOf(spriteA) - this._sprites.indexOf(spriteB);
	}
};

Layer.prototype.removeCanvas = function()
{
	// are we using our own canvas? are we the only ones using it?
	var removeIt = true;
	if (this._renderMode == 'webgl')
	{
		if (!this._hasOwnCanvas)
		{
			removeIt = false;
		}
		else
		{
			var layers = wade.getAllLayers();
			for (var i=0; i<layers.length; i++)
			{
				if (layers[i] != this && layers[i].getCanvas() == this._canvas)
				{
					removeIt = false;
					this.disownCanvas();
					layers[i].ownCanvas();
					break;
				}
			}
		}
	}

	// go ahead and remove it if we are the only users
	if (this._canvas)
	{
		if (removeIt)
		{
			document.getElementById(wade.getContainerName()).removeChild(this._canvas);
			if (this._context && this._context.isWebGl)
			{
				resetContext(this._context);
				var loseContext = this._context.getExtension('WEBGL_lose_context');
				loseContext && loseContext.loseContext();
			}
		}
		else  // if other layers are using this canvas, they will need a full redraw
		{
			layers = wade.getAllLayers();
			for (i=0; i<layers.length; i++)
			{
				if (layers[i] != this && layers[i].getCanvas() == this._canvas)
				{
					layers[i].forceRedraw();
				}
			}
		}
	}

	this._context = null;
	this._canvas = null;
};

Layer.prototype.initCanvas = function()
{
	// in webgl mode, see if we can use the canvas of an existing webgl layer
	var parentLayer;
	if (this._renderMode == 'webgl' && wade.areGlLayersMerged())
	{
		var allLayers = wade.getAllLayers();
		var l = [];
		var thisLayerIndex = -1;
		for (var i=0; i<allLayers.length; i++)
		{
			if (this == allLayers[i] || (allLayers[i].getRenderMode() == 'webgl' && !allLayers[i].hasOwnCanvas()))
			{
				continue;
			}
			if (thisLayerIndex == -1 && this.id > allLayers[i].id)
			{
				thisLayerIndex = l.push(this) - 1;
			}
			l.push(allLayers[i]);
		}
		if (thisLayerIndex == -1)
		{
			thisLayerIndex = l.push(this) -1;
		}
		var p = l[thisLayerIndex-1];
		var n = l[thisLayerIndex+1];
		parentLayer = (p && p.getRenderMode() == 'webgl' && p.getResolutionFactor() == this._resolutionFactor && p) || (n && n.getRenderMode() == 'webgl' && n.getResolutionFactor() == this._resolutionFactor && n);
	}

	if (!parentLayer)
	{
		this._createCanvas();
		this._setupRenderTargets();
		this._hasOwnCanvas = true;
		return;
	}
	this._canvas = parentLayer.getCanvas();
	this._context = parentLayer.getContext();
	this._setupRenderTargets();
	this._f32ViewportSize[0] = this._canvas.width;
	this._f32ViewportSize[1] = this._canvas.height;

	// if the parent layer is above us (it can happen depending on layer creation order)
	// then we need to get ownership of its canvas
	if (parentLayer.id < this.id)
	{
		this._hasOwnCanvas = true;
		parentLayer.disownCanvas();
	}
	else
	{
		this._hasOwnCanvas = false;
		this._useOffScreenTarget = true;
	}
	if (this._context.currentImage)
	{
		for (var j=0; j<this._context.currentImage.length; j++)
		{
			this._context.currentImage[j] = null;
		}
	}
};

Layer.prototype.disownCanvas = function()
{
	this._hasOwnCanvas = false;
	this._useOffScreenTarget = true;
	this._needsFullRedraw = true;
};

Layer.prototype.ownCanvas = function()
{
	this._hasOwnCanvas = true;
	this._needsFullRedraw = true;
	this._canvas.style.zIndex = -this.id;
};

Layer.prototype.hasOwnCanvas = function()
{
	return this._hasOwnCanvas;
};

Layer.prototype._createCanvas = function()
{
	if (!this._canvas)
	{
		this._canvas = wade.createCanvas(this._resolutionFactor);
		this._canvas.id = 'wade_layer_' + this.id;
		this._canvas.style.zIndex = -this.id;
		if (this._renderMode != '2d')
		{
			try
			{
				this._context = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
				this._context.isWebGl = true;
			}
			catch (e) {}
			if (!this._context)
			{
				wade.log("Unable to use WebGL in this browser, falling back to 2d canvas");
			}
			else
			{
				this._setupWebGl(this._context, this._canvas);
			}
		}
		if (!this._context || this._renderMode == '2d')
		{
			this._context = this._canvas.getContext('2d');
		}
		else
		{
			this._renderMode = 'webgl';
		}
		this._context['imageSmoothingEnabled'] = this._context['mozImageSmoothingEnabled'] = this._context['msImageSmoothingEnabled'] = this._context['oImageSmoothingEnabled'] = this._smoothing;
		(this._renderMode == '2d') && this._context.save();
		this._needsFullRedraw = true;
	}
};

Layer.prototype.getCanvas = function()
{
	return this._canvas;
};

Layer.prototype._updateScaleConversionFactor = function()
{
	var cameraPosition = wade.getCameraPosition();
	this._scaleConversionFactor = (this._transform.scale / cameraPosition.z + 1 - this._transform.scale) * this._resolutionFactor;
};

Layer.prototype._spriteSorter_bottomToTop = function(spriteA, spriteB)
{
	var delta = spriteA.getPosition().y + spriteA.getSortPoint().y * spriteA.getSize().y - spriteB.getPosition().y - spriteB.getSortPoint().y * spriteB.getSize().y;
	return (Math.abs(delta) < wade.c_epsilon)? (spriteA.id > spriteB.id? 1 : -1) : (delta > 0)? 1 : -1;
};

Layer.prototype._spriteSorter_topToBottom = function(spriteA, spriteB)
{
	var delta = spriteB.getPosition().y + spriteB.getSortPoint().y * spriteB.getSize().y - spriteA.getPosition().y - spriteA.getSortPoint().y * spriteA.getSize().y;
	return (Math.abs(delta) < wade.c_epsilon)? (spriteA.id > spriteB.id? 1 : -1) : (delta > 0)? 1 : -1;
};

Layer.prototype._initQuadTree = function()
{
	// make the quad tree a bit bigger than the layer's world bounds (so if objects move a bit, we don't have to re-init immediately)
	var scale = 1.5;
	var halfSizeX = (this._worldBounds.maxX - this._worldBounds.minX) / 2;
	var halfSizeY = (this._worldBounds.maxY - this._worldBounds.minY) / 2;
	var centerX = this._worldBounds.minX + halfSizeX;
	var centerY = this._worldBounds.minY + halfSizeY;

	this._quadTree = new QuadTreeNode(0, centerX - halfSizeX * scale, centerY - halfSizeY * scale, centerX + halfSizeX * scale, centerY + halfSizeY * scale);
};

Layer.prototype._addSpriteToQuadTree = function(sprite)
{
	// make sure that the quadtree contains the layer's world bounds
	if (!wade.boxContainsBox(this._quadTree, this._worldBounds))
	{
		// if it doesn't, we need to expand the quadtree and rebuild it
		this._initQuadTree();

		// re-add all the sprites to the quadtree
		for (var i=0; i<this._sprites.length; i++)
		{
			this._quadTree.addObject(this._sprites[i]);
		}
	}
	else
	{
		this._quadTree.addObject(sprite);
	}
};

Layer.prototype._joinDirtyAreas = function()
{
	// if we have no dirty areas, return a zero-sized rectangle
	if (!this._dirtyAreas.length)
	{
		return {minX: 0, minY: 0, maxX: 0, maxY: 0};
	}

	// precalculate variables and default result
	var halfWidth = wade.getScreenWidth() / 2;
	var halfHeight = wade.getScreenHeight() / 2;
	var screen = this.screenBoxToWorld({minX: -halfWidth, minY: -halfHeight, maxX: halfWidth, maxY: halfHeight});
	var result = {minX: screen.maxX, minY: screen.maxY, maxX: screen.minX, maxY: screen.minY};

	// calculate a bounding box that encompasses all dirty areas that are on the screen
	for (var i=0; i<this._dirtyAreas.length; i++)
	{
		var area = this._dirtyAreas[i];
		if (wade.boxIntersectsBox(screen, area))
		{
			wade.expandBox(result, area);
		}
	}

	// clamp the resulting area to the screen
	wade.clampBoxToBox(result, screen);

	// avoid negative width and height
	if (result.maxX <= result.minX || result.maxY <= result.minY)
	{
		result = 0;
	}
	return result;
};

Layer.prototype.setResolutionFactor = function(resolutionFactor)
{
	if (resolutionFactor != this._resolutionFactor)
	{
		this._resolutionFactor = resolutionFactor;
		this._updateScaleConversionFactor();
		this.resize(wade.getScreenWidth(), wade.getScreenHeight());
		this.removeCanvas();
		this.initCanvas();
	}
};

Layer.prototype.getResolutionFactor = function()
{
	return this._resolutionFactor;
};

Layer.prototype.setSmoothing = function(toggle)
{
	if (toggle != this._smoothing)
	{
		this._smoothing = toggle;
		this._context.restore();
		this._context['imageSmoothingEnabled'] = this._context['mozImageSmoothingEnabled'] = this._context['msImageSmoothingEnabled'] = this._context['oImageSmoothingEnabled'] = toggle;
		this._context.save();
		this._needsFullRedraw = true;
	}
};

Layer.prototype.getSmoothing = function()
{
	return this._smoothing;
};

Layer.prototype.addSpritesInAreaToArray = function(area, array, sorted)
{
	if (sorted && this._sortingFunction)
	{
		var tempArray = [];
		this._quadTree.addObjectsInAreaToArray(area, tempArray);
		tempArray.sort(this._sortingFunction);
		for (var i=tempArray.length-1; i>=0; i--)
		{
			array.push(tempArray[i]);
		}
	}
	else
	{
		this._quadTree.addObjectsInAreaToArray(area, array, array.length);
	}
};

Layer.prototype.toDataURL = function()
{
	return this._canvas.toDataURL();
};

Layer.prototype.forceRedraw = function()
{
	this._needsFullRedraw = true;
};

Layer.prototype.setOpacity = function(opacity)
{
	if (opacity != this._opacity)
	{
		this._opacity = opacity;
		if (this._renderMode == 'webgl')
		{
			this._mainRenderTarget.uniformValues.rotationAlpha[1] = opacity;
			if (!this._useOffScreenTarget)
			{
				this._useOffScreenTarget = true;
			}
		}
		this._needsFullRedraw = true;
	}
};

Layer.prototype.getOpacity = function()
{
	return this._opacity;
};

Layer.prototype.clear = function()
{
	var screenWidth = wade.getScreenWidth() * this._resolutionFactor;
	var screenHeight = wade.getScreenHeight() * this._resolutionFactor;
	var context = this._context;
	if (this._renderMode == 'webgl')
	{
		this._context.clear(this._context.COLOR_BUFFER_BIT);
	}
	else
	{
		context.save();
		context.setTransform(1,0,0,1,0,0);
		context.clearRect(0, 0, Math.round(screenWidth), Math.round(screenHeight));
		context.restore();
	}
};

Layer.prototype.useQuadtree = function(toggle)
{
	if (toggle != this._useQuadtree)
	{
		this._useQuadtree = toggle;
		if (this._useQuadtree)
		{
			this._quadTree.empty();
			for (var i=0; i<this._sprites.length; i++)
			{
				this._addSpriteToQuadTree(this._sprites[i]);
			}
		}
	}
};

Layer.prototype.isUsingQuadtree = function()
{
	return this._useQuadtree;
};

Layer.prototype.set3DTransform = function(transformString, transformOrigin, time, callback)
{
	var setOnElement = function(c)
	{
		if (time)
		{
			c.style['MozTransition'] = '-moz-transform ' + time + 's';
			c.style['msTransition'] = '-ms-transform ' + time + 's';
			c.style['OTransition'] = '-O-transform ' + time + 's';
			c.style['WebkitTransition'] = '-webkit-transform ' + time + 's';
			c.style['transition'] = 'transform ' + time + 's';
			var f = function()
			{
				callback && callback();
				callback = null;
				c.removeEventListener('transitionend', f);
			};
			c.addEventListener('transitionend', f, true);
		}
		else
		{
			c.style['MozTransition'] = '-moz-transform 0';
			c.style['msTransition'] = '-ms-transform 0';
			c.style['OTransition'] = '-O-transform 0';
			c.style['WebkitTransition'] = '-webkit-transform 0';
			c.style['transition'] = 'transform 0';
		}
		c.style['MozTransform'] = c.style['msTransform'] = c.style['OTransform'] = c.style['webkitTransform'] = c.style['transform'] = transformString;
		c.style['MozTransformOrigin'] = c.style['msTransformOrigin'] = c.style['OTransformOrigin'] = c.style['webkitTransformOrigin'] = c.style['transformOrigin'] = transformOrigin;
		!time && callback && callback();
	};
	this._canvas && setOnElement(this._canvas);
};

Layer.prototype.getIndexOfSprite = function(sprite)
{
	return this._sprites.indexOf(sprite);
};

Layer.prototype.setIndexOfSprite = function(sprite, index)
{
	var currentIndex = this._sprites.indexOf(sprite);
	if (currentIndex != -1 && index != currentIndex)
	{
		wade.removeObjectFromArrayByIndex(currentIndex, this._sprites);
		if (this._sprites.length > index)
		{
			this._sprites.splice(index, 0, sprite);
			return index;
		}
		return this._sprites.push(sprite) - 1;
	}
	return -1;
};

Layer.prototype.getPixelShader = function(context, shaderSource, customUniforms)
{
	if (this._renderMode != 'webgl')
	{
		wade.log('cannot use pixel shaders in canvas mode');
		return;
	}

	// if shader is in cache, return the cached version
	var pixelShader = context.pixelShaders[shaderSource];
	if (pixelShader)
	{
		return pixelShader;
	}

	// parse parameters
	var paramString = '';
	if (customUniforms)
	{
		for (var p in customUniforms)
		{
			if (customUniforms.hasOwnProperty(p))
			{
				paramString += 'uniform ' + customUniforms[p] + ' ' + p + ';\n';
			}
		}
	}

	// add variable declarations
	var fullSource = "precision mediump int; precision mediump float;\n\
	varying vec4 uvAlphaTime;\n\
	uniform sampler2D uDiffuseSampler;\n\
	uniform vec4 uCustomPsParameters;\n" + paramString;

	// if shader source does not contain a definition of the main function, put it all into a main function
	var s = shaderSource.trim().replace(/\n|\r/g, '').replace(/\t/g, ' ');
	var mainPos = s.indexOf('void main');
	var hasMainFunction = false;
	if (mainPos != -1)
	{
		var rest = s.substr(mainPos + 'void main'.length).trim();
		if (rest[0] == '(')
		{
			hasMainFunction = true;
		}
	}
	if (hasMainFunction)
	{
		fullSource += '\n#line 1\n' + shaderSource;
	}
	else
	{
        fullSource += "void main(void) {\n#line 1\n" + shaderSource + '\n}';
	}

	// compile
	pixelShader = context.createShader(context.FRAGMENT_SHADER);
	context.shaderSource(pixelShader, fullSource);
	context.compileShader(pixelShader);
	pixelShader.hash = wade.hashString(shaderSource).toString();
	pixelShader.customUniforms = customUniforms;

	// check for errors
	if (!context.getShaderParameter(pixelShader, context.COMPILE_STATUS))
	{
		wade.shaderErrorLog("An error occurred compiling a pixel shader: " + context.getShaderInfoLog(pixelShader));
		return;
	}

	// no errors, we may want to long a successful compile
	wade.shaderSuccessLog('Pixel shader compiled successfully');

	// cache it and return it
	context.pixelShaders[shaderSource] = pixelShader;
	return pixelShader;
};

Layer.prototype.getVertexShader = function(context, shaderSource)
{
	if (this._renderMode != 'webgl')
	{
		wade.log('cannot use vertex shaders in canvas mode');
		return;
	}

	// if shader is in cache, return the cached version
	var vertexShader = context.vertexShaders[shaderSource];
	if (vertexShader)
	{
		return vertexShader;
	}

	// compile
	vertexShader = context.createShader(context.VERTEX_SHADER);
	context.shaderSource(vertexShader, shaderSource);
	context.compileShader(vertexShader);
	vertexShader.hash = wade.hashString(shaderSource).toString();

	// check for errors
	if (!context.getShaderParameter(vertexShader, context.COMPILE_STATUS))
	{
		wade.log("An error occurred compiling a vertex shader: " + context.getShaderInfoLog(vertexShader));
		return;
	}

	// cache it and return it
	context.vertexShaders[shaderSource] = vertexShader;
	return vertexShader;

};

Layer.prototype.getShaderProgram = function(context, vertexShader, pixelShader)
{
	if (this._renderMode != 'webgl')
	{
		wade.log('cannot use shader programs in canvas mode');
		return;
	}

	vertexShader = vertexShader || context.defaultVertexShader;
	pixelShader = pixelShader || context.defaultPixelShader;

	// check cache first, return a cached version if available
	var shaderProgram = context.shaderPrograms[vertexShader.hash + pixelShader.hash];
	if (shaderProgram)
	{
		return shaderProgram;
	}

	// link shader program
	shaderProgram = context.createProgram();
	context.attachShader(shaderProgram, vertexShader);
	context.attachShader(shaderProgram, pixelShader);
	context.linkProgram(shaderProgram);
	if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS))
	{
		wade.log('Unable to link a WebGl shader program');
		return;
	}

	// cache attribute locations
	shaderProgram.attributes = {};
	shaderProgram.attributes.vertexPosition = context.getAttribLocation(shaderProgram, 'aVertexPosition');
	shaderProgram.attributes.positionAndSize = context.getAttribLocation(shaderProgram, 'uPositionAndSize');
	shaderProgram.attributes.animFrameInfo = context.getAttribLocation(shaderProgram, 'uAnimFrameInfo');
	shaderProgram.attributes.rotationAlpha = context.getAttribLocation(shaderProgram, 'uRotationAlpha');

	// cache uniform locations
	shaderProgram.uniforms = {};
	shaderProgram.uniforms['uCameraScaleTranslateTime'] = context.getUniformLocation(shaderProgram, 'uCameraScaleTranslateTime');
	shaderProgram.uniforms['uViewportSize'] = context.getUniformLocation(shaderProgram, 'uViewportSize');
	shaderProgram.uniforms['uPositionAndSize'] = context.getUniformLocation(shaderProgram, 'uPositionAndSize');
	shaderProgram.uniforms['uAnimFrameInfo'] = context.getUniformLocation(shaderProgram, 'uAnimFrameInfo');
	shaderProgram.uniforms['uRotationAlpha'] = context.getUniformLocation(shaderProgram, 'uRotationAlpha');
	shaderProgram.uniforms['uDiffuseSampler'] = context.getUniformLocation(shaderProgram, 'uDiffuseSampler');
	shaderProgram.uniforms['uOtherSampler'] = context.getUniformLocation(shaderProgram, 'uOtherSampler');
	if (pixelShader.customUniforms)
	{
		for (var u in pixelShader.customUniforms)
		{
			shaderProgram.uniforms[u] = context.getUniformLocation(shaderProgram, u);
		}
	}

	// cache it and return it
	context.shaderPrograms[vertexShader.hash + pixelShader.hash] = shaderProgram;
	return shaderProgram;
};

Layer.prototype.getDefaultPixelShaderSource = function()
{
	return	"highp vec4 color = texture2D(uDiffuseSampler, uvAlphaTime.xy); \ncolor.w *= uvAlphaTime.z; \ngl_FragColor = color;";
};

Layer.prototype.getCompositePixelShaderSource = function()
{
	return	"highp vec4 color = texture2D(uDiffuseSampler, uvAlphaTime.xy); \ncolor.w *= uvAlphaTime.z; \ncolor.xyz *= color.w;\ngl_FragColor = color;";
};

Layer.prototype.getBlurPixelShaderSource = function()
{
	return ["vec2 uv = uvAlphaTime.xy;",
		"highp vec4 color = vec4(0.,0.,0.,0.);",
		"highp vec4 c;",
		"c = texture2D(uDiffuseSampler, uv + uDelta * -2.); color += c * 1./16.;",
		"c = texture2D(uDiffuseSampler, uv + uDelta * -1.); color += c * 4./16.;",
		"c = texture2D(uDiffuseSampler, uv + uDelta *  0.); color += c * 6./16.;",
		"c = texture2D(uDiffuseSampler, uv + uDelta *  1.); color += c * 4./16.;",
		"c = texture2D(uDiffuseSampler, uv + uDelta *  2.); color += c * 1./16.;",
		"gl_FragColor = color;"].join('\n');
};

Layer.prototype.getBlendPixelShaderSource = function()
{
	return ["vec2 uv = uvAlphaTime.xy;",
			"gl_FragColor = mix(texture2D(uDiffuseSampler, uv), texture2D(uOtherSampler, uv), uBlendFactor);",
			"gl_FragColor.w *= uvAlphaTime.z;",
			"gl_FragColor.xyz *= uvAlphaTime.z;"].join('\n');
};

Layer.prototype.setShaderProgram = function(shaderProgram)
{
	var context = this._context;
	if (context.currentShader != shaderProgram)
	{
		context.useProgram(context.currentShader = shaderProgram);
		context.uniform2fv(context.currentShader.uniforms['uViewportSize'], this._f32ViewportSize);
		context.uniform4fv(context.currentShader.uniforms['uCameraScaleTranslateTime'], this._f32CameraScaleTranslateTime);
	}
};

Layer.prototype._bindSingleSpriteVertexBuffer = function()
{
	if (!this._batchedBufferBound)
	{
		return;
	}
	this._batchedBufferBound = false;
	var context = this._context;
	context.bindBuffer(context.ARRAY_BUFFER, context.squareVertexBuffer);
	context.vertexAttribPointer(context.defaultShaderProgram.attributes.vertexPosition, 2, context.FLOAT, false, 0, 0);
};

Layer.prototype._bindBatchedSpriteVertexBuffer = function()
{
	if (this._batchedBufferBound)
	{
		return;
	}
	this._batchedBufferBound = true;
	var context = this._context;
	context.bindBuffer(context.ARRAY_BUFFER, context.batchedVertexBuffer);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.vertexPosition, 2, context.FLOAT, false, context.batchedQuadSize, 0);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.positionAndSize, 4, context.FLOAT, false, context.batchedQuadSize , 2 * 4);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.animFrameInfo, 4, context.FLOAT, false, context.batchedQuadSize , 6 * 4);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.rotationAlpha, 2, context.FLOAT, false, context.batchedQuadSize , 10 * 4);
};

Layer.prototype._setupWebGl = function(context, canvas)
{
	// clear
	context.clearColor(0,0,0,0);
	context.clear(context.COLOR_BUFFER_BIT);

	// init shader cache
	context.vertexShaders = {};
	context.pixelShaders = {};
	context.shaderPrograms = {};

	// vertex shader
	var vertexShaderSource =
		["attribute vec2 aVertexPosition;",
			"uniform vec4 uCameraScaleTranslateTime;",
			"uniform vec2 uViewportSize;",
			"uniform vec4 uPositionAndSize;",
			"uniform vec4 uAnimFrameInfo;",
			"uniform vec2 uRotationAlpha;",
			"varying highp vec4 uvAlphaTime;",
			"void main(void) {",
			"float s = sin(uRotationAlpha.x);",
			"float c = cos(uRotationAlpha.x);",
			"vec2 pos = aVertexPosition * uPositionAndSize.zw;",  // scale
			"pos = vec2(pos.x * c - pos.y * s, pos.y * c + pos.x * s);",  // rotate
			"pos += uPositionAndSize.xy * 2.0;",  // translate
			"pos *= uCameraScaleTranslateTime.x;",  // camera scale
			"pos -= uCameraScaleTranslateTime.yz * 2.0;",  // camera translate
			"pos /= uViewportSize;",
			"pos.y *= -1.0;",
			"uvAlphaTime.xy = (aVertexPosition + 1.0) * 0.5;",
			"uvAlphaTime.x = (uAnimFrameInfo.z < 0.0)? 1.0 - uvAlphaTime.x : uvAlphaTime.x;",
			"uvAlphaTime.y = (uAnimFrameInfo.w < 0.0)? 1.0 - uvAlphaTime.y : uvAlphaTime.y;",
			"uvAlphaTime.xy *= abs(uAnimFrameInfo.zw);",
			"uvAlphaTime.xy += uAnimFrameInfo.xy;",
			"uvAlphaTime.z = uRotationAlpha.y;",
			"uvAlphaTime.w = uCameraScaleTranslateTime.w;",
			"gl_Position = vec4(pos, 0.0, 1.0);",
			"}"].join('\n');
	var vertexShader = context.defaultVertexShader = this.getVertexShader(context, vertexShaderSource);

	// pixel shader
	var pixelShaderSource = this.getDefaultPixelShaderSource();
	var pixelShader = context.defaultPixelShader = this.getPixelShader(context, pixelShaderSource);

	// link shader program
	var shaderProgram = this.getShaderProgram(context, vertexShader, pixelShader);
	if (!shaderProgram)
	{
		wade.error('Unable to compile default shader');
		return;
	}
	context.defaultShaderProgram = this._postProcessShaderProgram = shaderProgram;
	this.setShaderProgram(shaderProgram);

	// blur pixel shader
	var blurShaderSource = this.getBlurPixelShaderSource();
	var blurPixelShader = this.getPixelShader(context, blurShaderSource, {uDelta: 'vec2'});
	context.blurShaderProgram = this.getShaderProgram(context, vertexShader, blurPixelShader);

	// blend pixel shader
	var blendShaderSource = this.getBlendPixelShaderSource();
	var blendPixelShader = this.getPixelShader(context, blendShaderSource, {uOtherSampler: 'sampler2D', uBlendFactor: 'float'});
	context.blendShaderProgram = this.getShaderProgram(context, vertexShader, blendPixelShader);

	// composite pixel shader
	var compositeShaderSource = this.getCompositePixelShaderSource();
	var compositePixelShader = this.getPixelShader(context, compositeShaderSource);
	context.compositeShaderProgram = this.getShaderProgram(context, vertexShader, compositePixelShader);

	// default vertex buffer for sprites
	var squareVertexBuffer = context.createBuffer();
	var vertices =
		[
			1.0,  1.0,
			-1.0, 1.0,
			1.0,  -1.0,
			-1.0, -1.0
		];
	context.bindBuffer(context.ARRAY_BUFFER, squareVertexBuffer);
	context.bufferData(context.ARRAY_BUFFER, new Float32Array(vertices), context.STATIC_DRAW);
	context.squareVertexBuffer = squareVertexBuffer;
	context.enableVertexAttribArray(context.defaultShaderProgram.attributes.vertexPosition);

	// batched vertex shader
	var batchedVertexShaderSource =[
		"attribute vec2 aVertexPosition;",
		"uniform vec4 uCameraScaleTranslateTime;",
		"uniform vec2 uViewportSize;",
		"attribute vec4 uPositionAndSize;",
		"attribute vec4 uAnimFrameInfo;",
		"attribute vec2 uRotationAlpha;",
		"varying highp vec4 uvAlphaTime;",
		"void main(void) {",
		"float s = sin(uRotationAlpha.x);",
		"float c = cos(uRotationAlpha.x);",
		"vec2 pos = aVertexPosition * uPositionAndSize.zw;",  // scale
		"pos = vec2(pos.x * c - pos.y * s, pos.y * c + pos.x * s);",  // rotate
		"pos += uPositionAndSize.xy * 2.0;",  // translate
		"pos *= uCameraScaleTranslateTime.x;",  // camera scale
		"pos -= uCameraScaleTranslateTime.yz * 2.0;",  // camera translate
		"pos /= uViewportSize;",
		"pos.y *= -1.0;",
		"uvAlphaTime.xy = (aVertexPosition + 1.0) * 0.5;",
		"uvAlphaTime.x = (uAnimFrameInfo.z < 0.0)? 1.0 - uvAlphaTime.x : uvAlphaTime.x;",
		"uvAlphaTime.y = (uAnimFrameInfo.w < 0.0)? 1.0 - uvAlphaTime.y : uvAlphaTime.y;",
		"uvAlphaTime.xy *= abs(uAnimFrameInfo.zw);",
		"uvAlphaTime.xy += uAnimFrameInfo.xy;",
		"uvAlphaTime.z = uRotationAlpha.y;",
		"uvAlphaTime.w = uCameraScaleTranslateTime.w;",
		"gl_Position = vec4(pos, 0.0, 1.0);",
		"}"].join('\n');
	var batchedVertexShader = context.defaultBatchedVertexShader = this.getVertexShader(context, batchedVertexShaderSource);

	// batched shader program
	var batchedShaderProgram = this.getShaderProgram(context, batchedVertexShader, pixelShader);
	if (!batchedShaderProgram)
	{
		wade.error('Unable to compile default batched shader');
		return;
	}
	context.batchedShaderProgram = batchedShaderProgram;

	// default batched vertex buffer for sprites
	var batchedVertexBuffer = context.createBuffer();
	var vbForOneElement =
		[
			//   vec2 aVertexPosition  	  vec4 uPositionAndSize	  vec4 uAnimFrameInfo	  vec2 uRotationAlpha
			1.0,  1.0,               0.0, 0.0, 16.0, 16.0,   0.0, 0.0, 1.0, -1.0,    0.0, 1.0,
			-1.0,  1.0,               0.0, 0.0, 16.0, 16.0,   0.0, 0.0, 1.0, -1.0,    0.0, 1.0,
			1.0, -1.0,               0.0, 0.0, 16.0, 16.0,   0.0, 0.0, 1.0, -1.0,    0.0, 1.0,
			-1.0, -1.0,               0.0, 0.0, 16.0, 16.0,   0.0, 0.0, 1.0, -1.0,    0.0, 1.0
		];
	var batchedVertices = [];
	for (var i=0; i<this._maxBatchSize; i++)
	{
		for (var j=0; j<vbForOneElement.length; j++)
		{
			batchedVertices.push(vbForOneElement[j]);
		}
	}
	context.batchedVertices = batchedVertices = new Float32Array(batchedVertices);
	context.batchedQuadSize = vbForOneElement.length;
	context.bindBuffer(context.ARRAY_BUFFER, batchedVertexBuffer);
	context.bufferData(context.ARRAY_BUFFER, batchedVertices, context.DYNAMIC_DRAW);
	context.batchedVertexBuffer = batchedVertexBuffer;

	// batched index buffer
	var batchedIndexBuffer = context.batchedIndexBuffer = context.createBuffer();
	var ibForOneElement = [0, 1, 2, 1, 3, 2];
	var batchedIndices = [];
	for (i=0; i<this._maxBatchSize; i++)
	{
		for (j=0; j<ibForOneElement.length; j++)
		{
			batchedIndices.push(ibForOneElement[j] + i * 4);
		}
	}
	context.batchedIndices = batchedIndices = new Uint16Array(batchedIndices);
	context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, batchedIndexBuffer);
	context.bufferData(context.ELEMENT_ARRAY_BUFFER, batchedIndices, context.STATIC_DRAW);
	context.enableVertexAttribArray(context.batchedShaderProgram.attributes.vertexPosition);
	context.enableVertexAttribArray(context.batchedShaderProgram.attributes.positionAndSize);
	context.enableVertexAttribArray(context.batchedShaderProgram.attributes.animFrameInfo);
	context.enableVertexAttribArray(context.batchedShaderProgram.attributes.rotationAlpha);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.vertexPosition, 2, context.FLOAT, false, context.batchedQuadSize, 0);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.positionAndSize, 4, context.FLOAT, false, context.batchedQuadSize , 2 * 4);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.animFrameInfo, 4, context.FLOAT, false, context.batchedQuadSize , 6 * 4);
	context.vertexAttribPointer(context.batchedShaderProgram.attributes.rotationAlpha, 2, context.FLOAT, false, context.batchedQuadSize , 10 * 4);

	this._batchedBufferBound = true;
	this._bindSingleSpriteVertexBuffer();

	// initialize diffuse sampler
	context.activeTexture(context.TEXTURE0);
	context.uniform1i(shaderProgram.uniforms["uDiffuseSampler"], 0);

	// render states
	context.disable(context.DEPTH_TEST);
	context.enable(context.BLEND);
	context.blendFuncSeparate(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA, context.ONE, context.ONE_MINUS_SRC_ALPHA);
	context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

	// texture cache
	context.textures = {};
	context.setTextureImage = function(image, preloadOnly, textureUnit) // called when we want to set a texture before rendering a sprite
	{
		var imageName = image && image.imageName || '';
		textureUnit = textureUnit || 0;
		// if it's the same texture that is currently set, no need to do anything
		if (context.currentImage[textureUnit] == imageName)
		{
			return;
		}

		// if it's a different texture and we have it in our cache, get it from the cache
		if (context.textures[imageName])
		{
			if (!preloadOnly)
			{
				context.bindTexture(context.TEXTURE_2D, context.textures[imageName]);
			}
		}
		else // texture is not in the cache
		{
			if (image)
			{
				var texture = context.createTexture();
				context.bindTexture(context.TEXTURE_2D, texture);
				wade.texImage2D(context, {width: image && image.width || 0, height: image && image.height || 0, image: image});
				context.textures[imageName] = texture;
				wade.addImageUser(imageName, this);
				if (preloadOnly)
				{
					context.bindTexture(context.TEXTURE_2D, null);
					context.currentImage[textureUnit] = null;
				}
			}
			else
			{
				context.currentImage[textureUnit] = null;
			}
		}
		if (!preloadOnly)
		{
			context.currentImage[textureUnit] = imageName;
		}
	};
	context.setActiveImage = function(imageName) // called by WADE when the Sampler0 texture changes
	{
		context.bindTexture(context.TEXTURE_2D, context.textures[imageName]);
		var image = wade.getImage(imageName);
		wade.texImage2D(context, {width: image.width, height: image.height, image: image});
	};
	context.onImageUnloaded = function(imageName)
	{
		context.deleteTexture(context.textures[imageName]);
		delete context.textures[imageName];
	};
	context.currentImage = [];

	// global alpha
	context.globalAlpha = 1;

	// initial viewport setup
	this._f32ViewportSize[0] = this._canvas.width;
	this._f32ViewportSize[1] = this._canvas.height;
	context.viewport(0, 0, canvas.width, canvas.height);
	context.uniform2fv(shaderProgram.uniforms['uViewportSize'], this._f32ViewportSize);
};

Layer.prototype._createRenderTarget = function(width, height)
{
	var context = this._context;
	var rt = context.createFramebuffer();
	context.bindFramebuffer(context.FRAMEBUFFER, rt);
	context.disable(context.DEPTH_TEST);
	rt.texture = context.createTexture();
	context.bindTexture(context.TEXTURE_2D, rt.texture);
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR); // because the texture is most likely NPOT
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR); // need this for NPOT? maybe not, not sure
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE); // need this for NPOT
	context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE); // need this for NPOT
	context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, width, height, 0, context.RGBA, context.UNSIGNED_BYTE, null);
	context.framebufferTexture2D(context.FRAMEBUFFER, context.COLOR_ATTACHMENT0, context.TEXTURE_2D, rt.texture, 0);
	context.bindTexture(context.TEXTURE_2D, null);
	context.bindFramebuffer(context.FRAMEBUFFER, null);
	return rt;
};

Layer.prototype._setupRenderTargets = function()
{
	if (this._renderMode != 'webgl')
	{
		return;
	}

	// main render target
	var width = this._canvas.width;
	var height = this._canvas.height;
	var qw = Math.floor(width / 4);
	var qh = Math.floor(height / 4);
	this._mainRenderTarget = this._createRenderTarget(width, height);
	this._quarterSizeRenderTarget = this._createRenderTarget(qw, qh);
	this._blurRenderTargetH = this._createRenderTarget(qw, qh);
	this._blurRenderTargetHV = this._createRenderTarget(qw, qh);
	this._mainRenderTarget.uniformValues =
	{
		positionAndSize: new Float32Array([0, 0, width, height]),
		animFrameInfo: new Float32Array([0, 0, 1, -1]),
		rotationAlpha: new Float32Array([0, this._opacity]),
		imageArea: new Float32Array([0,0,1,1])
	};
	this._quarterSizeRenderTarget.uniformValues =
	{
		positionAndSize: new Float32Array([0, 0, qw, qh])
	};
	this._context.textures['_layerRenderTarget_' + this.id] = this._mainRenderTarget.texture;
	this._context.textures['_layerBlur_' + this.id] = this._blurRenderTargetHV.texture;
};

var resetContext = function(context)
{
	var numAttribs = context.getParameter(context.MAX_VERTEX_ATTRIBS);
	var tmp = context.createBuffer();
	context.bindBuffer(context.ARRAY_BUFFER, tmp);
	for (var ii = 0; ii < numAttribs; ++ii)
	{
		context.disableVertexAttribArray(ii);
		context.vertexAttribPointer(ii, 4, context.FLOAT, false, 0, 0);
		context.vertexAttrib1f(ii, 0);
	}
	context.deleteBuffer(tmp);

	var numTextureUnits = context.getParameter(context.MAX_TEXTURE_IMAGE_UNITS);
	for (ii = 0; ii < numTextureUnits; ++ii)
	{
		context.activeTexture(context.TEXTURE0 + ii);
		context.bindTexture(context.TEXTURE_CUBE_MAP, null);
		context.bindTexture(context.TEXTURE_2D, null);
	}

	context.activeTexture(context.TEXTURE0);
	context.useProgram(null);
	context.bindBuffer(context.ARRAY_BUFFER, null);
	context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, null);
	context.bindFramebuffer(context.FRAMEBUFFER, null);
	context.bindRenderbuffer(context.RENDERBUFFER, null);
	context.disable(context.BLEND);
	context.disable(context.CULL_FACE);
	context.disable(context.DEPTH_TEST);
	context.disable(context.DITHER);
	context.disable(context.SCISSOR_TEST);
	context.blendColor(0, 0, 0, 0);
	context.blendEquation(context.FUNC_ADD);
	context.blendFunc(context.ONE, context.ZERO);
	context.clearColor(0, 0, 0, 0);
	context.clearDepth(1);
	context.clearStencil(-1);
	context.colorMask(true, true, true, true);
	context.cullFace(context.BACK);
	context.depthFunc(context.LESS);
	context.depthMask(true);
	context.depthRange(0, 1);
	context.frontFace(context.CCW);
	context.hint(context.GENERATE_MIPMAP_HINT, context.DONT_CARE);
	context.lineWidth(1);
	context.pixelStorei(context.PACK_ALIGNMENT, 4);
	context.pixelStorei(context.UNPACK_ALIGNMENT, 4);
	context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
	context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	if (context.UNPACK_COLORSPACE_CONVERSION_WEBGL)
	{
		context.pixelStorei(context.UNPACK_COLORSPACE_CONVERSION_WEBGL, context.BROWSER_DEFAULT_WEBGL);
	}
	context.polygonOffset(0, 0);
	context.sampleCoverage(1, false);
	context.scissor(0, 0, context.canvas.width, context.canvas.height);
	context.stencilFunc(context.ALWAYS, 0, 0xFFFFFFFF);
	context.stencilMask(0xFFFFFFFF);
	context.stencilOp(context.KEEP, context.KEEP, context.KEEP);
	context.viewport(0, 0, context.canvas.width, context.canvas.height);
	context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT | context.STENCIL_BUFFER_BIT);

	// clear texture cache
	for (var t in context.textures)
	{
		if (context.textures.hasOwnProperty(t))
		{
			wade.removeImageUser(t, context);
			context.deleteTexture(context.textures[t]);
		}
	}
	delete context.textures;

	// clear shader cache
	context.shaderPrograms = {};
	context.pixelShaders = {};
	context.vertexShaders = {};
};

Layer.prototype.setRenderMode = function(renderMode, options, dontStoreOptions)
{
	var useOffScreenTarget = options && options.offScreenTarget || !this._hasOwnCanvas;
	if (!dontStoreOptions)
	{
		this._renderOptions = options && wade.cloneObject(options);
	}
	if (!!useOffScreenTarget != !!this._useOffScreenTarget)
	{
		this._useOffScreenTarget = !!useOffScreenTarget;
		this._needsFullRedraw = true;
	}
	if (renderMode != this._renderMode)
	{
		if (this._renderMode == 'webgl' && this._canvas && !wade.isSharedCanvas(this._canvas))
		{
			this._context && resetContext(this._context);
		}

		// delete canvas and create a new one in webgl mode
		this.removeCanvas();
		this._renderMode = renderMode;
		if (this._renderMode == 'webgl' && !wade.isWebGlSupported())
		{
			this._renderMode = '2d';
		}
		this.initCanvas();

		// refresh custom sprite shaders if needed
		if (this._renderMode == 'webgl')
		{
			for (var i=0; i<this._sprites.length; i++)
			{
				this._sprites[i].refreshShader();
			}
		}
	}
	if ((this._blur || this._postProcessShaderProgram != this._context.defaultShaderProgram) && !this._useOffScreenTarget)
	{
		this._useOffScreenTarget = true;
		this._needsFullRedraw = true;
	}
};

Layer.prototype.getRenderMode = function()
{
	return this._renderMode;
};

Layer.prototype.getF32ViewportSize = function()
{
	return this._f32ViewportSize;
};

Layer.prototype.setPostProcessShader = function(shaderSource, shaderUniforms)
{
	if (shaderSource && this._renderMode != 'webgl')
	{
		wade.warn('It is not possible to use post process shaders on a non-webgl layer. Post processing will be ignored for layer ' + this.id);
		return;
	}
	if (this._postProcessShaderSource == shaderSource && this._postProcessUniforms == shaderUniforms)
	{
		return;
	}
	this._postProcessShaderSource = shaderSource;
	if (shaderSource)
	{
		this.setRenderMode(this._renderMode, {offScreenTarget: true}, true);
		var context = this._context;
		var ps = this.getPixelShader(context, shaderSource, shaderUniforms);
		this._postProcessShaderProgram = this.getShaderProgram(context, null, ps);
		this._typedPostProcessUniforms = {};
		if (shaderUniforms)
		{
			this._postProcessUniforms = wade.cloneObject(shaderUniforms);
			for (var u in shaderUniforms)
			{
				if (shaderUniforms.hasOwnProperty(u))
				{
					switch (shaderUniforms[u])
					{
						case 'vec2':
							this._typedPostProcessUniforms[u] = new Float32Array([0, 0]);
							break;
						case 'vec3':
							this._typedPostProcessUniforms[u] = new Float32Array([0, 0, 0]);
							break;
						case 'vec4':
							this._typedPostProcessUniforms[u] = new Float32Array([0, 0, 0, 0]);
							break;
						case 'ivec2':
							this._typedPostProcessUniforms[u] = new Int32Array([0, 0]);
							break;
						case 'ivec3':
							this._typedPostProcessUniforms[u] = new Int32Array([0, 0, 0]);
							break;
						case 'ivec4':
							this._typedPostProcessUniforms[u] = new Int32Array([0, 0, 0, 0]);
							break;
					}
				}
			}
		}
	}
	else
	{
		this._postProcessUniforms = this._typedPostProcessUniforms = null;
		this._postProcessShaderProgram = this._context.defaultShaderProgram;
		this.setRenderMode(this._renderMode, this._renderOptions);
	}
	if (this._postProcessShaderProgram != this._context.defaultShaderProgram)
	{
		this._useOffScreenTarget = true;
	}
	this._needsFullRedraw = true;
};

Layer.prototype.getPostProcessShader = function()
{
	return this._postProcessShaderSource || this.getDefaultPixelShaderSource();
};

Layer.prototype.getPostProcessShaderUniforms = function()
{
	return this._typedPostProcessUniforms && wade.cloneObject(this._postProcessUniforms) || null;
};

Layer.prototype.setCustomProperty = function(key, value)
{
	this._customProperties[key] = value;
};

Layer.prototype.getCustomProperty = function(key)
{
	return this._customProperties[key];
};

Layer.prototype.getCustomProperties = function()
{
	return wade.cloneObject(this._customProperties);
};

Layer.prototype.setCustomProperties = function(properties)
{
	this._customProperties = wade.cloneObject(properties);
};

Layer.prototype.getDefaultShaderProgram = function()
{
	return this._context.defaultShaderProgram;
};

Layer.prototype.enableBatching = function(toggle)
{
	this._batchingEnabled = !!toggle;
};

Layer.prototype.isBatchingEnabled = function()
{
	return !!this._batchingEnabled;
};

Layer.prototype.setBlur = function(blurAmount)
{
	if (blurAmount != this._blur)
	{
		this._useOffScreenTarget = this._useOffScreenTarget || !!blurAmount;
		this._needsFullRedraw = true;
		this._blur = blurAmount;
	}
};

Layer.prototype.getBlur = function()
{
	return this._blur;
};

Layer.prototype.alwaysUpdateBlur = function(toggle)
{
	this._alwaysUpdateBlur = toggle;
};
