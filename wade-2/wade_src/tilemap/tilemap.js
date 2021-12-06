/**
 * This is a tilemap plugin for the Wade Game Engine by Clockwork Chilli.
 * @version 1.0
 * @constructor
 */
Wade_tilemap = function()
{
    var self = this;
    var tileScaleFactor = 1.0;
    var terrainLayerId = 30;
    var loadingState = {};
    var initialized, terrain, tilemapBehavior, map;
    this.collisionMap = [];

    var initialize = function(params)
    {
        if (!initialized)
        {
            self.init(params && params.terrain);
        }
    };

    this.init = function(params)
    {
        initialized = true;
        params = params || {};
        (typeof(params.terrainLayerId) == 'number') && (terrainLayerId = params.terrainLayerId);

        // create a terrain and add it to the scene if there is one tile or more
        params.dontClearCanvas && wade.setCanvasClearing(terrainLayerId, false);
        terrain = new SceneObject(0, TiledTerrain, 0, 0, 'tilemap_terrain');
        terrain.tilemap = {};
        tilemapBehavior = terrain.getBehavior();
        (typeof(params.tileSize) == 'object') && (tilemapBehavior.c_tileSize = wade.cloneObject(params.tileSize));
        if (typeof(params.numTiles) == 'object')
        {
            var numTilesX = params.numTiles.x;
            var numTilesY = params.numTiles.y;
        }
        else if(params.numTilesX != undefined && params.numTilesY != undefined)
        {
            numTilesX = params.numTilesX;
            numTilesY = params.numTilesY;
        }
        numTilesX = numTilesX || 0;
        numTilesY = numTilesY || 0;
        if (numTilesX && numTilesY)
        {
            wade.addSceneObject(terrain, true);
        }

        // Default texture
        var back = new Sprite(0, terrainLayerId);
        back.setSize(tilemapBehavior.c_tileSize.x, tilemapBehavior.c_tileSize.x);
        back.setDrawFunction(wade.drawFunctions.solidFill_('white'));
        back.drawToImage('_wade_tilemapDefault', false, null, null, '', '2d');
        var grid = new Sprite(0, terrainLayerId);
        grid.setSize(tilemapBehavior.c_tileSize.x, tilemapBehavior.c_tileSize.x);
        grid.setDrawFunction(wade.drawFunctions.drawRect_('purple', 2));
        grid.drawToImage('_wade_tilemapGrid', false, null, null, '', '2d');

        // if we have a map, load terrain
        if (params.map)
        {
            loadingState = {};
            if (typeof(params.map) == 'string')
            {
                wade.loadJson(params.map, null, function(data)
                {
                    map = {data: wade.cloneObject(data)};
                    tilemapBehavior.loadData_begin(map.data, finishedLoading_('terrain', params.callback));
                });
            }
            else
            {
                map = wade.cloneObject(params.map);
                tilemapBehavior.loadData_begin(map.data, finishedLoading_('terrain', params.callback));
            }
        }
        else
        {
            tilemapBehavior.setNumTiles(numTilesX, numTilesY);
        }

        if (!params.map && params.callback)
        {
            params.callback();
        }
    };

    /**
     * Import tilemap terrain from a data object
     * @param {Object} data The tilemap scene data object
     * @param {function} [callback] A function to call when the assets referenced in the data have been fully loaded and added to the scene
     */
    this.importScene = function(data, callback)
    {
        this.reset(data);
        map = {data: data};
        tilemapBehavior.loadData_begin(map.data, finishedLoading_('terrain', callback));
    };

    var finishedLoading_ = function(what, callback)
    {
        return function()
        {
            loadingState[what] = 1;
            if (loadingState['terrain']) //  && loadingState['objects']
            {
                callback && callback();
            }
        };
    };

    /*
    /**
     * Set collision information for a tile, specifying which object occupies the tile
     * @param {number} x The isometric X coordinate of the tile
     * @param {number} y The isometric Y coordinate of the tile
     * @param {Object} [tilemapObject] The isometric object that occupies the tile

    this.setCollisionAtTile = function(x, y, isoObject)
    {
        if (!this.collisionMap[x])
        {
            this.collisionMap[x] = [];
        }
        this.collisionMap[x][y] = isoObject;
    };*/

    /**
     * Get the size (in world units) of a terrain tile
     * @returns {{x: number, y: number}} An object representing the size of a terrain tile
     */
    this.getTileSize = function()
    {
        initialize();
        return wade.cloneObject(tilemapBehavior.c_tileSize);
    };

    /**
     * Get the sprite being used as a terrain tile at the specified tile coordinates
     * @param {number} tileX The index of the tile on the tilemap X axis
     * @param {number} tileY The index of the tile on the tilemap Y axis
     * @returns {Sprite} The sprite at the current tile coordinates
     */
    this.getTileSprite = function(tileX, tileY)
    {
        return tilemapBehavior && tilemapBehavior.tileSprites[tileX] && tilemapBehavior.tileSprites[tileX][tileY];
    };

    /**
     * Get the data associated with a specific tile
     * @param {number} tileX The index of the tile on the tilemap X axis
     * @param {number} tileY The index of the tile on the tilemap Y axis
     * @returns {Object} An object containing any data associated with a specific tile ( such as which image file it's using, if it has animations, and any other data set with setTile() ).
     */
    this.getTileData = function(tileX, tileY)
    {
        return tilemapBehavior && tilemapBehavior.getTileData(tileX, tileY);
    };

    /**
     * Get the sprite being used as a terrain transition at the specified tile coordinates
     * @param {number} tileX The index of the tile on the tilemap X axis
     * @param {number} tileY The index of the tile on the tilemap Y axis
     * @returns {Sprite} The sprite at the current tile coordinates
     */
    this.getTransitionSprite = function(tileX, tileY)
    {
        return tilemapBehavior && tilemapBehavior.transitionSprites[tileX] && tilemapBehavior.transitionSprites[tileX][tileY];
    };

    /**
     * Get the data associated with a specific terrain transition
     * @param {number} tileX The index of the tile on the tilemap X axis
     * @param {number} tileY The index of the tile on the tilemap Y axis
     * @returns {Object} An object containing any data associated with a specific terrain transition ( such as which image file it's using, if it has animations, and any other data set with setTransition() ).
     */
    this.getTransitionData = function(tileX, tileY)
    {
        return tilemapBehavior && tilemapBehavior.getTransitionData(tileX, tileY);
    };

    /**
     * Get the sprite being used as a terrain detail at the specified tile coordinates
     * @param {number} tileX The index of the tile on the tilemap X axis
     * @param {number} tileY The index of the tile on the tilemap Y axis
     * @returns {Sprite} The sprite at the current tile coordinates
     */
    this.getDetailSprite = function(tileX, tileY)
    {
        return tilemapBehavior && tilemapBehavior.detailSprites[tileX] && tilemapBehavior.detailSprites[tileX][tileY];
    };

    /**
     * Get the data associated with a specific terrain detail
     * @param {number} tileX The index of the tile on the tilemap X axis
     * @param {number} tileY The index of the tile on the tilemap Y axis
     * @returns {Object} An object containing any data associated with a specific terrain detail ( such as which image file it's using, if it has animations, and any other data set with setDetail() ).
     */
    this.getDetailData = function(tileX, tileY)
    {
        return tilemapBehavior && tilemapBehavior.getDetailData(tileX, tileY);
    };

    /**
     * Check to see if there are any objects with collision in a specific tile
     * @param {number} x The tilemap X coordinate of the tile
     * @param {number} y The tilemap Y coordinate of the tile
     * @param {sceneObject} excludeObject An option object to ignore, mostly for collisions with self
     * @returns {boolean} Whether there are any objects with collision in the tile
     */
    this.checkCollisionsAtTile = function(x, y, excludeObject)
    {
        var obj = this.collisionMap && this.collisionMap[x] && this.collisionMap[x][y];
        if(excludeObject && (obj == excludeObject))
        {
            return false;
        }
        return !!obj;
    };

    this.setTiles = function(tileIds, tileTemplates, startX, startY, endX, endY)
    {
        initialize();
        return tilemapBehavior.setTiles(tileIds, tileTemplates, startX, startY, endX, endY);
    };

    this.setTile = function(x, y, tileData)
    {
        initialize();
        return tilemapBehavior.setTile(x, y, tileData);
    };

    this.setTransitions = function(tileIds, tileTemplates, startX, startY, endX, endY)
    {
        initialize();
        return tilemapBehavior.setTransitions(tileIds, tileTemplates, startX, startY, endX, endY);
    };

    this.setTransition = function(x, y, transitionData)
    {
        initialize();
        return tilemapBehavior.setTransition(x, y, transitionData);
    };

    this.setDetails = function(tileIds, tileTemplates, startX, startY, endX, endY)
    {
        initialize();
        return tilemapBehavior.setDetails(tileIds, tileTemplates, startX, startY, endX, endY);
    };

    this.setDetail = function(x, y, detailData)
    {
        initialize();
        return tilemapBehavior.setDetail(x, y, detailData);
    };

    /**
     * Set the current number of tiles
     * @param {number} x How many tiles on the tilemap X axis
     * @param {number} y How many tiles on the tilemap Y axis
     */
    this.setNumTiles = function(x, y)
    {
        initialize();
        if (x && y && terrainNotAddedToScene())
        {
            wade.addSceneObject(terrain, true);
        }
        else if (!x && !y && !terrainNotAddedToScene())
        {
            wade.removeSceneObject(terrain);
        }
        tilemapBehavior.setNumTiles(x, y);
    };

    /**
     * Get the coordinates, in world space, corresponding to an isometric tile
     * @param {number|object} tileX The tile index on the isometric X axis. Alternatively you can use an object with x and y fields, and omit the second parameter.
     * @param {number} [tileY] The tile index on the isometric Y axis
     * @returns {{x: number, y: number}} An object representing the world space position corresponding to the tile.
     */
    this.getWorldCoordinates = function(tileX, tileY)
    {
        initialize();
        if (typeof(tileX) == 'object' && typeof(tileY) == 'undefined')
        {
            tileY = tileX.y;
            tileX = tileX.x;
        }
        return tilemapBehavior.getWorldCoordinates(tileX, tileY);
    };

    /**
     * Get the tile coordinates (indices) corresponding to the spefified world-space positions
     * @param {number|object} worldX The X coordinate of the world-space position. Alternatively you can use an object with x and y fields, and omit the second parameter.
     * @param {number} [worldY] The Y coordinate of the world-space position
     * @returns {{x: number, y: number, valid: boolean}} An object with the tile x and y indices. There is also a <i>valid</i> flag indicating whether the tile is inside the current terrain boundaries.
     */
    this.getTileCoordinates = function(worldX, worldY)
    {
        initialize();
        if (typeof(worldX) == 'object' && typeof(worldY) == 'undefined')
        {
            worldY = worldX.y;
            worldX = worldX.x;
        }
        return tilemapBehavior.getTileCoordinates(worldX, worldY);
    };

    /**
     * Get the number of terrain tiles being used
     * @returns {{x: number, y: number}} The current number of tiles
     */
    this.getNumTiles = function()
    {
        return tilemapBehavior? {x: tilemapBehavior.numTilesX, y: tilemapBehavior.numTilesY} : {x: 0, y: 0};
    };

    /**
     * Get the layer Id that is being used by terrain sprites
     * @returns {number} The id of the layer used by terrain sprites
     */
    this.getTerrainLayerId = function()
    {
        return terrainLayerId;
    };

    /**
     * Get the tilemap terrain object
     * @returns {SceneObject} The isometric terrain object
     */
    this.getTerrain = function()
    {
        initialize();
        return terrain;
    };

    /**
     * Get the scale factor that is being applied to each terrain tile (often to compensate for floating-point errors).
     * @returns {number} The scale factor
     */
    this.getTileScaleFactor = function()
    {
        initialize();
        return tileScaleFactor;
    };

    /**
     * Restore the map
     */
    this.reset = function()
    {
        if (!initialized)
        {
            initialize();
            return;
        }
        this.setNumTiles(0, 0);
        this.collisionMap.length = 0;
        loadingState = {};
    };

    this.findPath = function(gridStart, gridGoal, movementType, maxPathLength)
    {
        initialize();
        var params =
        {
            start:  {x: gridStart.x, y: gridStart.y},
            target: {x: gridGoal.x,  y: gridGoal.y},
            collisionMap: this.collisionMap,
            movementOffsets: movementType,
            boundaries: {minX: 0, minY: 0, maxX: tilemapBehavior.numTilesX-1, maxY: tilemapBehavior.numTilesY-1},
            maxPathLength: maxPathLength
        };
        return wade.findPath(params);
    };

    this.moveObjectToTile = function(object, targetX, targetY, speed)
    {
        initialize();
        var character = object.getBehavior("TilemapCharacter");
        var gridCoords = character.tileCoordinates();
        if (typeof(object) == 'string')
        {
            object = wade.getSceneObject(object);
            if (!object)
            {
                return false;
            }
        }
        if (!speed)
        {
            if (self.updateObjectTile(object, targetX, targetY))
            {
                object.setPosition(tilemapBehavior.getWorldCoordinates(targetX, targetY));
                character.targetCoords = 0;
                // wade.removeObjectFromArray(object, movingObjects);
                return true;
            }
            else
            {
                return false;
            }
        }
        if (gridCoords.x == targetX && gridCoords.y == targetY)
        {
            return true;
        }
        character.targetCoords = {x: targetX, y: targetY};
        character.previousPosition = object.getPosition();
       // movingObjects.push(object);
        var worldCoords = tilemapBehavior.getWorldCoordinates(targetX, targetY);
        object.moveTo(worldCoords.x, worldCoords.y, speed);
        return true;
    };

    /**
     * Export the current map and its state to a JSON object that can be passed into the map parameter of wade.tilemap.init()
     * @param {boolean} [stringify] Whether to serialize the resulting JSON object to a string
     * @returns {object|string} The JSON object (or JSON string) representing the current map
     */
    this.exportMap = function(stringify)
    {
        initialize();
        // initialize map data
        var mapData =
        {
            version: "1.0",
            terrain:
            {
                numTilesX: tilemapBehavior.numTilesX,
                numTilesY: tilemapBehavior.numTilesY,
                tileData: [],
                tileDataIds: [],
                transitionData: [],
                transitionDataIds: [],
                detailData: [],
                detailDataIds: []
            }
        };

        // save tiles and transitions
        for (var i=0; i<tilemapBehavior.numTilesX; i++)
        {
            mapData.terrain.tileDataIds[i] = [];
            mapData.terrain.transitionDataIds[i] = [];
            for (var j=0; j<tilemapBehavior.numTilesY; j++)
            {
                if (tilemapBehavior.tileData[i] && tilemapBehavior.tileData[i][j])
                {
                    var tileData = tilemapBehavior.tileData[i][j];
                    var index = mapData.terrain.tileData.indexOf(tileData);
                    if (index == -1)
                    {
                        index = mapData.terrain.tileData.push(tileData) - 1;
                    }
                    mapData.terrain.tileDataIds[i][j] = index;
                }
                else
                {
                    mapData.terrain.tileDataIds[i][j] = -1;
                }
                if (tilemapBehavior.transitionData[i] && tilemapBehavior.transitionData[i][j])
                {
                    var transitionData = tilemapBehavior.transitionData[i][j];
                    index = mapData.terrain.transitionData.indexOf(transitionData);
                    if (index == -1)
                    {
                        index = mapData.terrain.transitionData.push(transitionData) - 1;
                    }
                    mapData.terrain.transitionDataIds[i][j] = index;
                }
                else
                {
                    mapData.terrain.transitionDataIds[i][j] = -1;
                }
            }
        }

        // save details
        for (i=0; i<tilemapBehavior.numTilesX; i++)
        {
            mapData.terrain.detailDataIds[i] = [];
            for (j=0; j<tilemapBehavior.numTilesY; j++)
            {
                if (tilemapBehavior.detailData[i] && tilemapBehavior.detailData[i][j])
                {
                    var detailData = tilemapBehavior.detailData[i][j];
                    index = mapData.terrain.detailData.indexOf(detailData);
                    if (index == -1)
                    {
                        index = mapData.terrain.detailData.push(detailData) - 1;
                    }
                    mapData.terrain.detailDataIds[i][j] = index;
                }
                else
                {
                    mapData.terrain.detailDataIds[i][j] = -1;
                }
            }
        }

        if (stringify)
        {
            try
            {
                mapData = JSON.stringify(mapData);
            }
            catch (e)
            {
                wade.log("Unable to convert map data to a string. It may contain circular references.")
            }
        }
        return mapData;
    };

    /**
     * Draw a grid on the tilemap terrain. Very useful during development and for debugging.
     * @param {boolean} [toggle] Whether to draw the grid or not. If omitted, it's assumed to be true.
     */
    this.drawGrid = function(toggle)
    {
        initialize();
        if (typeof(toggle) == 'undefined')
        {
            toggle = true;
        }
        tilemapBehavior.drawGrid(toggle);
    };

    var terrainNotAddedToScene = function()
    {
        return !wade.getSceneObject('tilemap_terrain');
    };

};

/**
 * This is the object used to interact with the tilemap engine
 * @type {Wade_tilemap}
 */
wade.tilemap = new Wade_tilemap();