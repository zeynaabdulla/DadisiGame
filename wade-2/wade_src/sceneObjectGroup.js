/**
 * A SceneObjectGroup is an array of SceneObjects with some extra properties in addition to the usual Array ones. It allows you to manipulate several objects at once. In addition the methods listed in the SceneObjectGroup documentation, you can call any SceneObject functions on a SceneObjectGroup.
 * @param [groupData] {array|object} This parameter can be either an array of SceneObject or an object with the following fields: <br/><ul>
 * <li>sceneObjectNames: an array of scene object names</li>
 * <li>name: a string defining the name of the group</li></ul>
 * @constructor
 */
function SceneObjectGroup(groupData)
{
	var s;
	if (groupData && groupData.sceneObjectNames)
	{
		s = groupData.sceneObjectNames.map(function(x) {return wade.getSceneObject(x)});
	}
	else if (wade.isArray(groupData))
	{
		s = groupData;
	}
	else
	{
		s = [];
	}
	s._name = groupData && groupData.name || '';
	s._isInScene = false;

	// s gets all the properties in SceneObjectGroup.prototype
	for (var fs in SceneObjectGroup.prototype)
	{
		if (SceneObjectGroup.prototype.hasOwnProperty(fs) && typeof(s[fs]) == 'undefined')
		{
			s[fs] = SceneObjectGroup.prototype[fs];
		}
	}

	// you can also call any function in SceneObject.prototype directly
	for (var f in SceneObject.prototype)
	{
		if (typeof(SceneObject.prototype[f]) == 'function' && SceneObject.prototype.hasOwnProperty(f) && typeof(s[f]) == 'undefined')
		{
			(function(f)
			{
				s[f] = function()
				{
					var returnValues;
					for (var i=0; i < s.length; i++)
					{
						var r = s[i][f].apply(s[i], arguments);
						if (typeof(r) != 'undefined')
						{
							if (!returnValues)
							{
								returnValues = [];
								returnValues.length = i;
							}
						}
						returnValues && returnValues.push(r);
					}
					return returnValues;
				}
			})(f);
		}
	}

	return s;
}

/**
 * Get an axis-aligned bounding-box (in world space) that contains all the objects in the group
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} The bounding box
 */
SceneObjectGroup.prototype.getGroupBoundingBox = function()
{
	if (!this.length)
	{
		return {minX: 0, minY: 0, maxX: 0, maxY: 0};
	}
	var bb = this[0].getBoundingBox();
	for (var i=1; i<this.length; i++)
	{
		wade.expandBox(bb, this[i].getBoundingBox());
	}
	return bb;
};

/**
 * Get an axis-aligned bounding-box (in screen space) that contains all the objects in the group
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} The bounding box
 */
SceneObjectGroup.prototype.getGroupScreenBoundingBox = function()
{
	if (!this.length)
	{
		return {minX: 0, minY: 0, maxX: 0, maxY: 0};
	}
	var bb = this[0].getScreenBoundingBox();
	for (var i=1; i<this.length; i++)
	{
		wade.expandBox(bb, this[i].getScreenBoundingBox());
	}
	return bb;
};

/**
 * Get the center of the group in world space
 * @returns {{x: number, y: number}} The coordinates of the center point
 */
SceneObjectGroup.prototype.getGroupCenter = function()
{
	var bb = this.getGroupBoundingBox();
	return {x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2};
};

/**
 * Get the size of the group in world space
 * @returns {{x: number, y: number}} The size of the group
 */
SceneObjectGroup.prototype.getGroupSize = function()
{
	var bb = this.getGroupBoundingBox();
	return {x: bb.maxX - bb.minX, y: bb.maxY - bb.minY};
};

/**
 * Create a JSON object representing this SceneObjectGroup. A new SceneObjectGroup can then be created by passing this JSON object into the SceneObjectGroup constructor
 * @param {boolean} [stringify] Whether this function should return a string representation of the object
 * @returns {object|string} A data object representing this SceneObjectGroup
 */
SceneObjectGroup.prototype.serialize = function(stringify)
{
	var result =
	{
		type: 'SceneObjectGroup',
		name: this._name,
		sceneObjectNames: this.map(function(x) {return x && x.getName() || ''})
	};
	return stringify? JSON.stringify(result) : result;
};

/**
 * Set the center position of the group in world space
 * @param {number|object} positionX The position along the X axis. You can also use an object with <b>x</b> and <b>y</b> fields, omitting the second parameter.
 * @param {number} [positionY] The position along the Y axis
 */
SceneObjectGroup.prototype.setGroupCenter = function(positionX, positionY)
{
	// it may be easier sometimes to pass in a single parameter (as a vector that contains x and y)
	var posX, posY;
	if (typeof(positionX) == 'object')
	{
		posX = positionX.x;
		posY = positionX.y;
	}
	else
	{
		posX = positionX;
		posY = positionY;
	}
	var center = this.getGroupCenter();
	var dx = posX - center.x;
	var dy = posY - center.y;
	for (var i=0; i<this.length; i++)
	{
		var pos = this[i].getPosition();
		this[i].setPosition(pos.x + dx, pos.y + dy);
	}
};

/**
 * Translate (shift) the group in world space
 * @param {number|object} deltaX How much to move the object horizontally. You can also use an object with <b>x</b> and <b>y</b> fields, omitting the second parameter.
 * @param {number} [deltaY] How much to move the object vertically.
 */
SceneObjectGroup.prototype.translateGroup = function(deltaX, deltaY)
{
	var dx, dy;
	if (typeof(deltaX) == 'object')
	{
		dx = deltaX.x;
		dy = deltaX.y;
	}
	else
	{
		dx = deltaX;
		dy = deltaY;
	}
	for (var i=0; i<this.length; i++)
	{
		var pos = this[i].getPosition();
		this[i].setPosition(pos.x + dx, pos.y + dy);
	}
};

/**
 * Rotate all the objects in the group around the group center
 * @param {number} [rotation] The rotation amount, in radians
 */
SceneObjectGroup.prototype.rotateGroup = function(rotation)
{
	var center = this.getGroupCenter();
	for (var i=0; i<this.length; i++)
	{
		var rot = this[i].getRotation();
		this[i].setRotation(rot + rotation);
		var pos = this[i].getPosition();
		var offset = wade.vec2.sub(pos, center);
		wade.vec2.rotateInPlace(offset, rotation);
		this[i].setPosition(wade.vec2.add(offset, center));
	}
};

/**
 * Change the name of the SceneObjectGroup. Although you can have multiple groups with the same name, ry to use unique names to avoid ambiguous results when getting groups by name.
 * @param {string} name The new name
 */
SceneObjectGroup.prototype.setName = function(name)
{
	if (!this._name || this._name != name)
	{
		var oldName = this._name;
		this._name = name;
		wade.onObjectGroupNameChange(this, oldName, this._name);
	}
};

/**
 * Get the current name of the group
 * @returns {string} The name of the SceneObjectGroup
 */
SceneObjectGroup.prototype.getName = function()
{
	return this._name;
};

/**
 * Check whether the scene object group is currently in the scene
 * @returns {boolean} Whether the scene object group is currently in the scene
 */
SceneObjectGroup.prototype.isInScene = function()
{
	return this._inScene;
};
