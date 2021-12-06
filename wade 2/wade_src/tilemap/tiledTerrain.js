function TiledTerrain()
{
    this.name = 'TiledTerrain';
    this.tileSprites = [];
    this.tileData = [];
    this.gridSprites = [];
    this.transitionSprites = [];
    this.transitionData = [];
    this.detailSprites = [];
    this.detailData = [];
    this.c_tileSize = {x: 128, y: 128};
    this.c_origin  = {x: 0, y: 0};
    this.numTilesX = 0;
    this.numTilesY = 0;
    this.tileHighlightObjects = [];
    var drawingGrid = false;

    this.onAddToScene = function()
    {
        // start listening for mouse events
        this.owner.listenFor('onMouseDown');
        this.owner.listenFor('onMouseUp');
        this.owner.listenFor('onMouseClick');
        this.owner.listenFor('onMouseMove');

        // use a custom sort function for the terrain layer
        wade.setLayerSorting(wade.tilemap.getTerrainLayerId(), this.sortingFunction);
    };

    this.getTileHighlightObject = function(index)
    {
        if (this.tileHighlightObjects[index])
        {
            return this.tileHighlightObjects[index];
        }
        else
        {
            if (this.highlightTexture)
            {
                var sprite = new Sprite(this.highlightTexture, wade.tilemap.getTerrainLayerId());
                sprite.setSize(this.c_tileSize.x, this.c_tileSize.y);
                sprite.customSortOrder = 4;
                sprite.customSortIndex = 0;
                this.tileHighlightObjects[index] = new SceneObject(sprite);
                this.tileHighlightObjects[index].tilemap = {gridCoords: {x:0, y: 0}};
                wade.addSceneObject(this.tileHighlightObjects[index]);
            }
            else if (this.highlightSprite)
            {
                sprite = this.highlightSprite.clone();
                sprite.customSortOrder = 4;
                sprite.customSortIndex = 0;
                this.tileHighlightObjects[index] = new SceneObject(sprite);
                this.tileHighlightObjects[index].tilemap = {gridCoords: {x:0, y: 0}};
                wade.addSceneObject(this.tileHighlightObjects[index]);
            }
            return this.tileHighlightObjects[index];
        }
    };

    this.hideTileHighlightObjects = function()
    {
        for (var i=0; i<this.tileHighlightObjects.length; i++)
        {
            this.tileHighlightObjects[i] && this.tileHighlightObjects[i].setVisible(false);
        }
    };

    this.getHighlightObjects = function()
    {
        return wade.extend([], this.tileHighlightObjects);
    };

    this.loadData_begin = function(dataObject, callback)
    {
        this.finishedLoading_ = false;
        this.loadingList = [];
        var processedFiles = {'_wade_tilemapDefault': 1};
        this.completeRequests = 0;
        var k, fileName;
        for (k=0; k<dataObject.terrain.tileData.length; k++)
        {
            fileName = dataObject.terrain.tileData[k].texture;
            if (!processedFiles[fileName])
            {
                this.loadingList.push(fileName);
                processedFiles[fileName] = 1;
            }
        }
        for (k=0; k<dataObject.terrain.transitionData.length; k++)
        {
            fileName = dataObject.terrain.transitionData[k].texture;
            if (!processedFiles[fileName])
            {
                this.loadingList.push(fileName);
                processedFiles[fileName] = 1;
            }
        }
        for (k=0; k<dataObject.terrain.detailData.length; k++)
        {
            fileName = dataObject.terrain.detailData[k].texture;
            if (!processedFiles[fileName])
            {
                this.loadingList.push(fileName);
                processedFiles[fileName] = 1;
            }
        }
        if (this.loadingList.length)
        {
            for (k=0; k<this.loadingList.length; k++)
            {
                wade.loadImage(this.loadingList[k], this.onLoadingRequestComplete_(dataObject, callback));
            }
        }
        else
        {
            this.onLoadingRequestComplete_(dataObject, callback)(true);
        }
    };

    this.onLoadingRequestComplete_ = function(dataObject, callback)
    {
        var that = this;
        return function(forceComplete)
        {
            if (forceComplete === true || ++that.completeRequests == that.loadingList.length)
            {
                that.loadData_end(dataObject);
                if (!that.owner.isInScene() && that.numTilesX && that.numTilesY)
                {
                    wade.addSceneObject(that.owner, false);
                }
                that.finishedLoading_ = true;
                callback && callback();
            }
        }
    };

    this.loadData_end = function(dataObject)
    {
        var i, j;
        this.numTilesX = dataObject.terrain.numTilesX;
        this.numTilesY = dataObject.terrain.numTilesY;
        for (i=0; i<this.numTilesX; i++)
        {
            this.tileSprites[i] = [];
            this.tileData[i] = [];
            this.transitionSprites[i] = [];
            this.transitionData[i] = [];
            this.detailSprites[i] = [];
            this.detailData[i] = [];
            for (j=0; j<this.numTilesY; j++)
            {
                var tileData = dataObject.terrain.tileData[dataObject.terrain.tileDataIds[i][j]];
                var transitionData = dataObject.terrain.transitionData[dataObject.terrain.transitionDataIds[i][j]];
                var detailData = dataObject.terrain.detailData[dataObject.terrain.detailDataIds[i][j]];
                this.setTile(i, j, tileData);
                if (transitionData)
                {
                    this.setTransition(i, j, transitionData);
                }
                if (detailData)
                {
                    this.setDetail(i, j, detailData);
                }
            }
        }
    };

    this.setNumTiles = function(numTilesX, numTilesY)
    {
        var i, j;

        if (drawingGrid)
        {
            var _drawingGrid = true;
            this.drawGrid(false);
        }

        // remove existing data if we're setting a lower number of tiles
        for (i=numTilesX; i<this.numTilesX; i++)
        {
            for (j=0; j<this.numTilesY; j++)
            {
                this.setTile(i, j, 0);
                this.setTransition(i, j, 0);
            }
        }
        for (j=numTilesY; j<this.numTilesY; j++)
        {
            for (i=0; i<this.numTilesX; i++)
            {
                this.setTile(i, j, 0);
                this.setTransition(i, j, 0);
            }
        }
        for (i=numTilesX; i<this.numTilesX; i++)
        {
            for (j=0; j<this.numTilesY; j++)
            {
                this.setDetail(i, j, 0);
            }
        }
        for (j=numTilesY; j<this.numTilesY; j++)
        {
            for (i=0; i<this.numTilesX; i++)
            {
                this.setDetail(i, j, 0);
            }
        }

        this.tileData.length = this.transitionData.length = this.detailData.length = this.tileSprites.length = this.transitionSprites.length = this.detailSprites.length = this.gridSprites.length = numTilesX;
        for (i=0; i<numTilesX; i++)
        {
            this.tileData[i] && (this.tileData[i].length = numTilesY);
            this.transitionData[i] && (this.transitionData[i].length = numTilesY);
            this.detailData[i] && (this.detailData[i].length = numTilesY);
            this.tileSprites[i] && (this.tileSprites[i].length = numTilesY);
            this.transitionSprites[i] && (this.transitionSprites[i].length = numTilesY);
            this.detailSprites[i] && (this.detailSprites[i].length = numTilesY);
            this.gridSprites[i] && (this.gridSprites[i].length = numTilesY);
        }

        // create new tiles
        var oldNumTilesX = this.numTilesX;
        var oldNumTilesY = this.numTilesY;
        this.numTilesX = numTilesX;
        this.numTilesY = numTilesY;
        var defaultTileData = {texture: '_wade_tilemapDefault'};
        for (i=oldNumTilesX; i<numTilesX; i++)
        {
            this.tileSprites[i] = [];
            this.tileData[i] = [];
            this.transitionSprites[i] = [];
            this.transitionData[i] = [];
            this.detailSprites[i] = [];
            this.detailData[i] = [];
            for (j=0; j<numTilesY; j++)
            {
                this.setTile(i, j, defaultTileData);
            }
        }
        for (j=oldNumTilesY; j<numTilesY; j++)
        {
            for (i=0; i<oldNumTilesX; i++)
            {
                this.setTile(i, j, defaultTileData);
            }
        }

        if (_drawingGrid)
        {
            this.drawGrid(true);
        }
    };

    this.setTiles = function(tileIds, tileTemplates, startX, startY, endX, endY)
    {
        startX = startX || 0;
        startY = startY || 0;
        endX = endX || this.numTilesX;
        endY = endY || this.numTilesY;

        for(var i=0; i<tileIds.length; i++)
        {
            var x = i%(this.numTilesX);
            var y = Math.floor(i/this.numTilesX);
            if(x >= startX && x < endX && y >= startY && y < endY)
            {
                this.setTile(x, y, tileTemplates[tileIds[i]]);
            }
        }
    };

    this.setTile = function(x, y, tileData)
    {
        var collisionMap = wade.tilemap.collisionMap;
        if (!tileData || tileData.collision)
        {
            if (collisionMap[x] && collisionMap[x][y] && !collisionMap[x][y].isTerrainTile)
            {
                return false;
            }
            if (!collisionMap[x])
            {
                collisionMap[x] = [];
            }
            collisionMap[x][y] = {isTerrainTile: true, tileData: tileData};
        }
        else if (collisionMap[x] && collisionMap[x][y] && collisionMap[x][y].isTerrainTile)
        {
            collisionMap[x][y] = 0;
        }
        if (!this.tileSprites[x])
        {
            this.tileSprites[x] = [];
        }
        if (!this.tileData[x])
        {
            this.tileData[x] = [];
        }

        if (!tileData)
        {
            if (this.tileSprites[x] && this.tileSprites[x][y])
            {
                this.owner.removeSprite(this.tileSprites[x][y]);
            }
            this.tileSprites[x][y] = 0;
            if (this.transitionSprites[x] && this.transitionSprites[x][y])
            {
                this.setTransition(x, y, null);
            }
            if (this.detailSprites[x] && this.detailSprites[x][y])
            {
                this.setDetail(x, y, null);
            }
        }
        else
        {
            var w, h, width, height, tw, th, sprite;
            var createSprite = true;
            var texture = tileData.texture;
            if (texture)
            {
                var img = wade.getImage(texture);
                tw = img.width;
                th = img.height;
            }
            if (tileData.rotation)
            {
                texture += '_tilemap_rot_' + tileData.rotation;
                if (wade.getLoadingStatus(texture) != 'ok')
                {
                    var spr = new Sprite(tileData.texture);
                    spr.setRotation(tileData.rotation * Math.PI / 2);
                    spr.drawToImage(texture, true);
                }
            }
            var scale = tileData.scale || 1;
            width = this.c_tileSize.x * wade.tilemap.getTileScaleFactor() * scale;
            height = this.c_tileSize.y * wade.tilemap.getTileScaleFactor() * scale;

            var pos = this.getWorldCoordinates(x, y);
            if (this.tileSprites[x][y])
            {
                sprite = this.tileSprites[x][y];
                if (tileData.animation || this.tileData[x][y].animation)
                {
                    this.owner.removeSprite(sprite);
                    this.tileSprites[x][y] = 0;
                }
                else
                {
                    sprite.setImageFile(texture);
                    if (tileData.imageArea)
                    {
                        sprite.setImageArea(tileData.imageArea.minX, tileData.imageArea.minY, tileData.imageArea.maxX, tileData.imageArea.maxY);
                        if (tileData.customHeight)
                        {
                            w = tileData.imageArea.maxX - tileData.imageArea.minX;
                            h = tileData.imageArea.maxY - tileData.imageArea.minY;
                        }
                    }
                    sprite.setSize(width, height);
                    this.owner.setSpriteOffset(this.owner.getSpriteIndex(sprite), pos);
                    createSprite = false;
                }
            }
            if (createSprite)
            {
                if (tileData.animation)
                {
                    sprite = new Sprite(0, wade.tilemap.getTerrainLayerId());
                    var animation = new Animation(texture, tileData.animation.numFrames.x, tileData.animation.numFrames.y, tileData.animation.speed, true);
                    sprite.addAnimation('default', animation);
                    sprite.playAnimation('default');
                }
                else
                {
                    sprite = new Sprite(texture, wade.tilemap.getTerrainLayerId());
                }
                sprite.customSortOrder = 0;
                sprite.customSortIndex = x + y;
                sprite.gridCoords = {x: x, y: y};
                if (tileData.imageArea)
                {
                    sprite.setImageArea(tileData.imageArea.minX, tileData.imageArea.minY, tileData.imageArea.maxX, tileData.imageArea.maxY);
                    if (tileData.customHeight)
                    {
                        w = tileData.imageArea.maxX - tileData.imageArea.minX;
                        h = tileData.imageArea.maxY - tileData.imageArea.minY;
                        height = this.c_tileSize.x * wade.tilemap.getTileScaleFactor() *  h / w;
                    }
                }
                else if (tileData.customHeight && tw && th)
                {
                    height = this.c_tileSize.x * wade.tilemap.getScaleFactor() * th / tw;
                }

                sprite.setSize(width, height);
                this.tileSprites[x][y] = sprite;
                this.owner.addSprite(sprite, pos);
            }
        }
        this.tileData[x][y] = tileData;
        return true;
    };

    this.hideTileHighlightObjects = function()
    {
        for (var i=0; i<this.tileHighlightObjects.length; i++)
        {
            this.tileHighlightObjects[i] && this.tileHighlightObjects[i].setVisible(false);
        }
    };

    this.getHighlightObjects = function()
    {
        return wade.extend([], this.tileHighlightObjects);
    };

    this.setTransitions = function(tileIds, tileTemplates, startX, startY, endX, endY)
    {
        startX = startX || 0;
        startY = startY || 0;
        endX = endX || this.numTilesX;
        endY = endY || this.numTilesY;

        for(var i=0; i<tileIds.length; i++)
        {
            var x = i%(this.numTilesX);
            var y = Math.floor(i/this.numTilesX);
            if(x >= startX && x < endX && y >= startY && y < endY)
            {
                this.setTransition(x, y, tileTemplates[tileIds[i]]);
            }
        }
    };

    this.setTransition = function(x, y, data)
    {
        if (!this.transitionSprites[x])
        {
            this.transitionSprites[x] = [];
        }
        if (!this.transitionData[x])
        {
            this.transitionData[x] = [];
        }

        if (!data)
        {
            if (this.transitionSprites[x][y])
            {
                this.owner.removeSprite(this.transitionSprites[x][y]);
            }
            this.transitionSprites[x][y] = 0;
        }
        else
        {
            var createSprite = true;
            var texture = data.texture;
            if (data.rotation)
            {
                texture += '_tilemap_rot_' + data.rotation;
                if (wade.getLoadingStatus(texture) != 'ok')
                {
                    var spr = new Sprite(data.texture);
                    spr.setRotation(data.rotation * Math.PI / 2);
                    spr.drawToImage(texture, true);
                }
            }
            if (this.transitionSprites[x][y])
            {
                if (data.animation || this.transitionData[x][y].animation)
                {
                    this.owner.removeSprite(this.transitionSprites[x][y]);
                    this.transitionSprites[x][y] = 0;
                }
                else
                {
                    this.transitionSprites[x][y].setImageFile(texture);
                    data.imageArea && this.transitionSprites[x][y].setImageArea(data.imageArea.minX, data.imageArea.minY, data.imageArea.maxX, data.imageArea.maxY);
                    createSprite = false;
                }
            }

            var pos = this.getWorldCoordinates(x, y);
            if (createSprite)
            {
                var scale = data.scale || 1;
                var width = this.c_tileSize.x * wade.tilemap.getTileScaleFactor() * scale;
                var height = this.c_tileSize.y * wade.tilemap.getTileScaleFactor() * scale;
                var sprite;
                if (data.animation)
                {
                    sprite = new Sprite(0, wade.tilemap.getTerrainLayerId());
                    var animation = new Animation(data.texture, data.animation.numFrames.x, data.animation.numFrames.y, data.animation.speed, true);
                    sprite.addAnimation('default', animation);
                    sprite.playAnimation('default');
                }
                else
                {
                    sprite = new Sprite(texture, wade.tilemap.getTerrainLayerId());
                }
                sprite.setPosition(pos);
                sprite.setSize(width * wade.tilemap.getTileScaleFactor(), height * wade.tilemap.getTileScaleFactor());
                sprite.customSortOrder = 1;
                sprite.customSortIndex = x + y;
                data.imageArea && sprite.setImageArea(data.imageArea.minX, data.imageArea.minY, data.imageArea.maxX, data.imageArea.maxY);
                this.owner.addSprite(sprite);
                this.transitionSprites[x][y] = sprite;
            }
            this.owner.setSpriteOffset(this.owner.getSpriteIndex(this.transitionSprites[x][y]), pos);
        }
        this.transitionData[x][y] = data;
    };

    this.setDetails = function(tileIds, tileTemplates, startX, startY, endX, endY)
    {
        startX = startX || 0;
        startY = startY || 0;
        endX = endX || this.numTilesX;
        endY = endY || this.numTilesY;

        for(var i=0; i<tileIds.length; i++)
        {
            var x = i%(this.numTilesX);
            var y = Math.floor(i/this.numTilesX);
            if(x >= startX && x < endX && y >= startY && y < endY)
            {
                this.setDetail(x, y, tileTemplates[tileIds[i]]);
            }
        }
    };

    this.setDetail = function(x, y, data)
    {
        if (!this.detailSprites[x])
        {
            this.detailSprites[x] = [];
        }
        if (!this.detailData[x])
        {
            this.detailData[x] = [];
        }

        if (!data)
        {
            if (this.detailSprites[x][y])
            {
                this.owner.removeSprite(this.detailSprites[x][y]);
            }
            this.detailSprites[x][y] = 0;
        }
        else
        {
            var createSprite = true;
            var texture = data.texture;
            if (data.rotation)
            {
                texture += '_tilemap_rot_' + data.rotation;
                if (wade.getLoadingStatus(texture) != 'ok')
                {
                    var spr = new Sprite(data.texture);
                    spr.setRotation(data.rotation * Math.PI / 2);
                    spr.drawToImage(texture, true);
                }
            }
            if (this.detailSprites[x][y])
            {
                if (data.animation || this.detailData[x][y].animation)
                {
                    this.owner.removeSprite(this.transitionSprites[x][y]);
                    this.transitionSprites[x][y] = 0;
                }
                else
                {
                    this.detailSprites[x][y].setImageFile(texture);
                    data.imageArea && this.detailSprites[x][y].setImageArea(data.imageArea.minX, data.imageArea.minY, data.imageArea.maxX, data.imageArea.maxY);
                    createSprite = false;
                }
            }

            var pos = this.getWorldCoordinates(x, y);
            if (createSprite)
            {
                var scale = data.scale || 1;
                var width = this.c_tileSize.x * wade.tilemap.getTileScaleFactor() * scale;
                var height = this.c_tileSize.y * wade.tilemap.getTileScaleFactor() * scale;
                var sprite;
                if (data.animation)
                {
                    sprite = new Sprite(0, wade.tilemap.getTerrainLayerId());
                    var animation = new Animation(data.texture, data.animation.numFrames.x, data.animation.numFrames.y, data.animation.speed, true);
                    sprite.addAnimation('default', animation);
                    sprite.playAnimation('default');
                }
                else
                {
                    sprite = new Sprite(texture, wade.tilemap.getTerrainLayerId());
                }
                sprite.setSize(width * wade.tilemap.getTileScaleFactor() * scale, height * wade.tilemap.getTileScaleFactor() * scale);
                sprite.customSortOrder = 2;
                sprite.customSortIndex = x + y;
                data.imageArea && sprite.setImageArea(data.imageArea.minX, data.imageArea.minY, data.imageArea.maxX, data.imageArea.maxY);
                this.owner.addSprite(sprite);
                this.detailSprites[x][y] = sprite;
            }
            this.owner.setSpriteOffset(this.owner.getSpriteIndex(this.detailSprites[x][y]), pos);
        }
        this.detailData[x][y] = data;
    };

    var valueInRange = function(value, min, max)
    {
        return !!(value >= min && value <= max);
    };

    this.getWorldCoordinates = function(tileX, tileY)
    {
        var valid = tileX >=0 && tileY >=0 && tileX < this.numTilesX && tileY < this.numTilesY;
        var worldY = tileY*this.c_tileSize.y + this.c_origin.y;
        var worldX = tileX*this.c_tileSize.x + this.c_origin.x;
        return {x:worldX, y:worldY, valid: valid};
    };

    this.getTileCoordinates = function(worldX, worldY)
    {
        var cellX = Math.floor((worldX + this.c_tileSize.x/2 - this.c_origin.x) / this.c_tileSize.x);
        var cellY = Math.floor((worldY + this.c_tileSize.y/2 - this.c_origin.y) / this.c_tileSize.y);
        return {x:cellX, y:cellY, valid:(valueInRange(cellX, 0, this.numTilesX-1) && valueInRange(cellY, 0, this.numTilesY-1))};
    };

    this.onMouseDown = function(eventData)
    {
        if (wade.app.onTilemapTerrainMouseDown)
        {
            var tileCoords = this.getTileCoordinates(eventData.position.x, eventData.position.y);
            if (tileCoords.valid)
            {
                var worldCoords = this.getWorldCoordinates(tileCoords.x, tileCoords.y);
                return wade.app.onTilemapTerrainMouseDown(wade.extend({gridCoords: tileCoords, worldCoords: worldCoords}, eventData));
            }
        }
        return false;
    };

    this.onClick = function(eventData)
    {
        if (wade.app.onTilemapTerrainClick)
        {
            var tileCoords = this.getTileCoordinates(eventData.position.x, eventData.position.y);
            if (tileCoords.valid)
            {
                var worldCoords = this.getWorldCoordinates(tileCoords.x, tileCoords.y);
                return wade.app.onTilemapTerrainClick(wade.extend({gridCoords: tileCoords, worldCoords: worldCoords}, eventData));
            }
        }
        return false;
    };

    this.onMouseUp = function(eventData)
    {
        if (wade.app.onTilemapTerrainMouseUp)
        {
            var tileCoords = this.getTileCoordinates(eventData.position.x, eventData.position.y);
            if (tileCoords.valid)
            {
                var worldCoords = this.getWorldCoordinates(tileCoords.x, tileCoords.y);
                return wade.app.onTilemapTerrainMouseUp(wade.extend({gridCoords: tileCoords, worldCoords: worldCoords}, eventData));
            }
        }
        return false;
    };

    this.setHighlight = function(texture, offsets)
    {
        var i;
        this.highlightOffsets = offsets || [{x:0, z:0}];

        if (texture instanceof(Sprite))
        {
            if (this.highlightTexture)
            {
                for (i=0; i<this.tileHighlightObjects.length; i++)
                {
                    wade.removeSceneObject(this.tileHighlightObjects[i]);
                    this.tileHighlightObjects[i] = null;
                }
            }
            this.highlightSprite = texture;
            this.highlightTexture = null;
        }
        else
        {
            if (this.highlightSprite)
            {
                for (i=0; i<this.tileHighlightObjects.length; i++)
                {
                    wade.removeSceneObject(this.tileHighlightObjects[i]);
                }
                this.tileHighlightObjects.length = 0;
            }
            this.highlightTexture = texture;
            this.highlightSprite = null;
        }
        if (this.highlightTexture && this.highlightOffsets && this.highlightOffsets.length)
        {
            for (i=0; i<this.tileHighlightObjects.length; i++)
            {
                this.getTileHighlightObject(i).getSprite(0).setImageFile(texture);
            }
        }
        else if (this.highlightSprite)
        {
            for (i=0; i<this.tileHighlightObjects.length; i++)
            {
                this.getTileHighlightObject(i);
            }
        }
        else
        {
            this.hideTileHighlightObjects();
        }
    };

    this.onMouseMove = function(eventData)
    {
        var tileCoords, worldCoords;
        tileCoords = this.getTileCoordinates(eventData.position.x, eventData.position.y);
        if (tileCoords.valid && (this.highlightTexture || this.highlightSprite) && this.highlightOffsets && this.highlightOffsets.length)
        {
            for (var i=0; i<this.highlightOffsets.length; i++)
            {
                var gridOffset = this.highlightOffsets[i];
                worldCoords = this.getWorldCoordinates(tileCoords.x + gridOffset.x, tileCoords.y + gridOffset.y);
                var highlightObject = this.getTileHighlightObject(i);
                highlightObject.setPosition(worldCoords);
                highlightObject.setVisible(true);
                highlightObject.tilemap.gridCoords.x = tileCoords.x + gridOffset.x;
                highlightObject.tilemap.gridCoords.y = tileCoords.y + gridOffset.y;
            }
        }
        else
        {
            this.hideTileHighlightObjects();
        }
        wade.app.onTilemapTerrainMouseMove && wade.app.onTilemapTerrainMouseMove(wade.extend({}, eventData, {gridCoords: tileCoords}));
    };

    this.sortingFunction = function(spriteA, spriteB)
    {
        var delta = (spriteB.customSortIndex - spriteA.customSortIndex);
        return delta || (spriteA.customSortOrder - spriteB.customSortOrder);
    };

    this.sort = function()
    {
        wade.getLayer(wade.tilemap.getTerrainLayerId()).sort(this.sortingFunction);
    };

    this.getTileTexture = function(x, y)
    {
        return (this.tileSprites[x] && this.tileSprites[x][y] && this.tileSprites[x][y].getImageName());
    };

    this.getTileData = function(x, y)
    {
        return this.tileData[x] && this.tileData[x][y] && wade.cloneObject(this.tileData[x][y]);
    };

    this.getTransitionData = function(x, y)
    {
        return this.transitionData[x] && this.transitionData[x][y] && wade.cloneObject(this.transitionData[x][y]);
    };

    this.getDetailData = function(x, y)
    {
        return this.detailData[x] && this.detailData[x][y] && wade.cloneObject(this.detailData[x][y]);
    };

    this.drawGrid = function(toggle)
    {
        var i, j;
        var terrainLayerId = wade.tilemap.getTerrainLayerId();
        if (toggle && !drawingGrid)
        {
            for (i=0; i<this.numTilesX; i++)
            {
                this.gridSprites[i] = [];
                for (j=0; j<this.numTilesY; j++)
                {
                    var sprite = new Sprite('_wade_tilemapGrid', terrainLayerId);
                    sprite.customSortOrder = 3;
                    sprite.customSortIndex = i + j;
                    var pos = this.getWorldCoordinates(i, j);
                    // console.log(pos, this.tileSprites[i][j].getPosition());
                    sprite.setSize(this.c_tileSize.x * wade.tilemap.getTileScaleFactor(), this.c_tileSize.y * wade.tilemap.getTileScaleFactor());
                    this.owner.addSprite(sprite, pos);
                    this.gridSprites[i][j] = sprite;
                }
            }
            drawingGrid = true;
        }
        else if (!toggle && drawingGrid)
        {
            for (i=0; i<this.gridSprites.length; i++)
            {
                for (j=0; j<this.gridSprites[i].length; j++)
                {
                    this.owner.removeSprite(this.gridSprites[i][j])
                }
            }
            this.gridSprites.length = 0;
            drawingGrid = false;
        }
    };

}