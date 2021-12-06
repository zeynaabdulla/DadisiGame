/**
 * WADE Physics - This is the physics plugin module for WADE by Clockwork Chilli. It is based on the popular open-source Box2D physics engine.
 * To enable it, simply include the javascript file in your project (after the main WADE module), and include box2d.min.js
 * This object exposes a minimal interface that affects the global physics simulation.
 * Use the PhysicsObject behavior to control several per-object parameters.
 * @version 3.0
 * @constructor
 */
Wade_physics = function()
{
	var self = this;
	var scale = 30;					// how to scale between box2d units and wade units
	var initialized = false;		// whether the physics plugin has been initialized or not
	var running = false;			// is the physics simulation running or not
	var stepping = false;			// are we in the middle of a physics step

    var jointCount = 0; // Used to provide unique id format - SceneObjectAName_SceneObjectBName_jointType_jointCount
    var jointList = {}; // Key value map, joint names to joint objects

	var initialize = function()
	{
		!initialized && self.init();
	};

	/**
	 * Initialize the physics plugin.
	 * This function must be called once for the physics simulation to work.
	 * This normally happens automatically the fist time you try to use the physics engine and you don't need to call it directly from your code.
	 * @param {object} [options] An object with some of the following fields, which are all optional:<ul>
	 * <li><i>gravity</i>: an object with <i>x</i> and <i>y</i> fields, describing the gravity in meters/seconds squared. By default, this is {x:0, y:9.81}.</li>
	 * <li><i>timeStep</i>: the time interval used in the box2d Step function. Default is wade.c_timeStep</li>
	 * <li><i>positionIterations</i>: a number describing how many positions iterations to use in the box2d solver. Default is 4</li>
	 * <li><i>velocityIterations</i>: a number describing how many velocity iterations to use in the box2d solver. Default is 2</li></ul>
	 */
	this.init = function(options)
	{
		if (initialized)
		{
			wade.warn("Warning - attempting to initialize the physics engine when it's already been initialized");
			return;
		}
		if (!wade.requireVersion || !wade.requireVersion('3.0'))
		{
			wade.warn('Warning - This version of the WADE Physics plug-in requires a newer version of WADE (3.0 or newer)');
			return;
		}
		options = options || {};
		var gravity = options.gravity? {x: options.gravity.x, y: -options.gravity.y} : {x:0, y:-9.81};
		this.world.createWorld(gravity);
		options.timeStep && this.world.setTimeStep(options.timeStep);
		options.positionIterations && this.world.setPositionIterations(options.positionIterations);
		options.velocityIterations && this.world.setVelocityIterations(options.velocityIterations);
        this.collisions.init(); // start receiving collision events

		wade.setMainLoop(function()
		{
			running && self.step();
		}, '_wade_physics');
		initialized = true;
        running = true;
	};

	/**
	 * Check whether the physics engine has been initialized.
	 * @returns {boolean} Whether the physics engine has been initialized.
	 */
	this.isInitialized = function()
	{
		return initialized;
	};

	/**
	 * Stop (pause) the physics simulation.
	 */
	this.stopSimulation = function()
	{
		initialize();
		running = false;
	};

	/**
	 * Start the physics simulation. Note that the simulation is started automatically when <i>wade.physics.init()</i> is called, so it only makes sense to call this function after a call to <i>stopSimulation()</i>.
	 */
	this.startSimulation = function()
	{
		initialize();
		running = true;
	};

	/**
	 * Check whether the physics simulation is currently running
	 * @returns {boolean} Whether the physics simulation is currently running
	 */
	this.isRunning = function()
	{
		initialize();
		return running;
	};

	/**
	 * Step the box2d physics world forward. This normally happens automatically.
	 */
	this.step = function()
	{
		initialize();
		stepping = true;
		this.world.step();
		stepping = false;
	};

	/**
	 * Check whether we are in the middle of a physics step
	 * @returns {boolean}
	 */
	this.isStepping = function()
	{
		return stepping;
	};

	/**
	 * Get the current gravity vector
	 * @returns {{x: number, y: number}} The current gravity vector
	 */
	this.getGravity = function()
	{
		initialize();
		var g = this.world.getGravity();
		return {x: g.x, y: -g.y};
	};

    /**
     * Retrieve a joint object using it's name
     * @param {string} name The name of the joint that is to be retrieved
     * @returns {object} The joint object, or null, if there is no joint with the provided name
     */
    this.getJoint = function(name)
    {
        return (jointList[name] || null);
    };

	/**
	 * Set a new value for gravity (by default gravity is {x:0, y:9.81}
	 * @param {{x: number, y: number}} gravity  The new gravity vector
	 */
	this.setGravity = function(gravity)
	{
		initialize();
		return this.world.setGravity({x: gravity.x, y: -gravity.y});
	};

	/**
	 * Set the time step value for the physics simulation. By default this matches WADE's simulation time step (1/60 seconds)
	 * @param {number} timeStep The length (in seconds) of the time step for the physics simulation
	 */
	this.setTimeStep = function(timeStep)
	{
		this.world.timeStep = timeStep;
	};

	/**
	 * Get the current time step value for the physics simulation
	 * @returns {number} The current time step value for the physics simulation
	 */
	this.getTimeStep = function()
	{
		return this.world.timeStep;
	};

	/**
	 * Set the number of iterations for the physics position solver. By default this is 4.
	 * @param {number} positionIterations The number of iterations for the physics position solver. Use a larger number for greater accuracy (but it will be slower)
	 */
	this.setPositionIterations = function(positionIterations)
	{
		this.world.positionIterations = positionIterations;
	};

	/**
	 * Get the current number of iterations for the physics position solver.
	 * @returns {number} The current number of iterations for the physics position solver.
	 */
	this.getPositionIterations = function()
	{
		return this.world.positionIterations;
	};

	/**
	 * Get the current number of iterations ofr the physics velocity solver. By default this is 2.
	 * @param {number} velocityIterations The number of iterations for the physics velocity solver. Use a larger number for greater accuracy (but it will be slower)
	 */
	this.setVelocityIterations = function(velocityIterations)
	{
		this.world.velocityIterations = velocityIterations;
	};

	/**
	 * Get the current number of iterations for the physics velocity solver.
	 * @returns {number} The current number of iterations for the physics velocity solver.
	 */
	this.getVelocityIterations = function()
	{
		return this.world.velocityIterations;
	};

    /**
     * Serializes this list of joints and returns the result
     * @returns {object} serialized A serialized version of the joint interface object
     */
    this.serializeJoint = function(joint)
    {
        var serialized = {};
        for (var i in joint)
        {
            if (typeof(joint[i]) != 'function')
            {
                serialized[i] = typeof(joint[i]) == 'object'? (wade.isArray(joint[i])? wade.cloneArray(joint[i]) : wade.cloneObject(joint[i])) : joint[i];
            }
        }
        return serialized;
    };

    /**
     * Imports joints into the scene
     * @param data An object that contains a joints array
     * @param callback Executed after a zero timeout
     */
    this.importScene = function(data, callback)
    {
		setTimeout(function()
		{
			if (data && data.joints && data.joints.length)
			{
				for(var i=0; i<data.joints.length; i++)
				{
					self.addJoint(data.joints[i]);
				}
			}
            callback && callback();
        }, 0);
    };

    /**
     * Exports all joints currently in the joint list
     * @param stringify If true, a stringified json object is returned, if false, a javascript object is returned
     * @returns {object} data An object containing a joints array
     */
    this.exportScene = function(stringify)
    {
        var data = {joints:[]};
        for(var it in jointList)
        {
            if(!jointList.hasOwnProperty(it))
            {
                continue;
            }
            data.joints.push(this.serializeJoint(jointList[it]));
        }
        if(stringify)
        {
            return JSON.stringify(data);
        }
        return data;
    };

    /**
     * Adds a joint to the simulation
     * @param {object} jointData An object containing the joint type, and scene objects to connect
     * @returns {object} joint A joint interface created from joint data
     */
    this.addJoint = function(jointData)
    {
        if(jointData.jointType != "gear")
        {
            if(typeof(jointData.sceneObjectA) == "string")
            {
                jointData.sceneObjectA = wade.getSceneObject(jointData.sceneObjectA);
            }
            if(typeof(jointData.sceneObjectB) == "string")
            {
                jointData.sceneObjectB = wade.getSceneObject(jointData.sceneObjectB);
            }

            // Create name
            if(jointData.name)
            {
                var name = jointData.name;
                if(jointList[name])
                {
                    wade.warn("Adding a joint with name that matches existing joint, generating new name");
                }
            }
            else
            {
                name = jointData.sceneObjectA.name + "_" + jointData.sceneObjectB + "_" + jointData.jointType + "_" + jointCount++;
            }
            while(jointList[name])
            {
                name = jointData.sceneObjectA.name + "_" + jointData.sceneObjectB + "_" + jointData.jointType + "_" + jointCount++;
            }

            var physicsA = jointData.sceneObjectA.getBehavior("PhysicsObject");
            var physicsB = jointData.sceneObjectB.getBehavior("PhysicsObject");

            var joint = wade.physics._addJoint_[jointData.jointType](jointData.sceneObjectA, jointData.sceneObjectB, jointData);
            if (!joint)
			{
				return null;
			}
			joint.name = name;
            physicsA.addJoint(joint);
            physicsB.addJoint(joint);
        }
        else // Gear joint is special
        {
            if(typeof(jointData.jointA) == "string")
            {
                jointData.jointA = this.getJoint(jointData.jointA);
            }
            if(typeof(jointData.jointB) == "string")
            {
                jointData.jointB = this.getJoint(jointData.jointB);
            }

            // Create name
            name = "gear_" + jointCount++;
            joint = wade.physics._addJoint_[jointData.jointType](jointData.jointA, jointData.jointB, jointData);
            if (!joint)
			{
				return null;
			}
			joint.name = name;
        }

        jointList[name] = joint; // Add the joint to the list
        return joint;
    };

    /**
     * Removes the provided joint from the simulation
     * @param {object} jointObject The joint object to remove
     */
    this.removeJoint = function(jointObject)
    {
        var name = jointObject.name;
        if(jointList[name])
        {
            delete jointList[name];
        }
        else
        {
            wade.warn("Joint that was removed");
        }

        var physicsA = wade.getSceneObject(jointObject.sceneObjectA).getBehavior("PhysicsObject");
        var physicsB = wade.getSceneObject(jointObject.sceneObjectB).getBehavior("PhysicsObject");
        physicsA.removeJoint(jointObject);
        physicsB.removeJoint(jointObject);
        wade.physics._removeJoint_[jointObject.jointType](jointObject);
    };

    /**
     * Draw the joint using debug graphics
     * @param {object} joint A joint object, as returned by wade.physics.createJoint() or wade.physics.getJoint()
     * @param {boolean} active Whether to enable or disable debug-drawing
     * @returns {SceneObject} The SceneObject used to display the debug graphics
     */
    this.debugDrawJoint = function(joint, active)
    {
        var layerId = 1;
        var s;
        if (joint.sceneObjectA)
        {
            s = typeof(joint.sceneObjectA) == 'string'? _[joint.sceneObjectA] : joint.sceneObjectA;
        }
        if ((!s || !s.getSpriteCount()) && joint.sceneObjectB)
        {
            s = typeof(joint.sceneObjectB) == 'string'? _[joint.sceneObjectB] : joint.sceneObjectB;
        }
        if (s && s.getSpriteCount())
        {
            layerId = s.getSprite().getLayerId();
        }

        var color =
        {
            distance:  "#F00",
            friction:  "#0F0",
            gear:      "#00F",
            prismatic: "#FF0",
            pulley:    "#0FF",
            revolute:  "#F0F",
            rope:      "#AA0",
            weld:      "#0AA",
            wheel:     "#A0A"
        };

        var lineJointName = '__wade_line_joint_' + color[joint.jointType];

        // Make sure the images exist
        if (wade.getLoadingStatus('__wade_joint_end') != 'ok')
        {
            var jointSprite = new Sprite(null, layerId);
            jointSprite.setSize(10, 10);
            jointSprite.setDrawFunction(wade.drawFunctions.radialGradientCircle_(["red"], "red"));
            jointSprite.drawToImage("__wade_joint_end", true, null, null, '', '2d');
        }
        if (wade.getLoadingStatus(lineJointName) != 'ok')
        {
            var threadSprite = new Sprite(null, layerId);
            threadSprite.setSize(4, 40);
            threadSprite.setDrawFunction(wade.drawFunctions.solidFill_(color[joint.jointType]));
            threadSprite.drawToImage(lineJointName, true, null, null, '', '2d');
        }


        // Check if debug draw object exists
        var debugObject = wade.getSceneObject(joint.name + "_debugDraw");
        if(!active) // Remove draw object if it exists
        {
            if(!debugObject)
            {
                return null;
            }
            wade.removeSceneObject(debugObject);
            return null;
        }

        // Get the joint objects
        var objA, objB;
        if(joint.jointType == "gear")
        {
            var jointA = wade.physics.getJoint(joint.joint1);
            var jointB = wade.physics.getJoint(joint.joint2);
            if (!jointA || !jointB)
            {
                return null;
            }
            objA = wade.getSceneObject(jointA.sceneObjectA);
            if (!objA)
            {
                return null;
            }
        }
        else
        {
            objA = wade.getSceneObject(joint.sceneObjectA);
            objB = wade.getSceneObject(joint.sceneObjectB);
            if (!objA || !objB)
            {
                return null;
            }
        }

        if(debugObject)
        {
            var posA = wade.vec2.add(objA.getPosition(), joint.localAnchorA || {x:0, y:0});
            var posB = wade.vec2.add(objB.getPosition(), joint.localAnchorB || {x:0, y:0});
            debugObject.updateOffsets(posA, posB); // Update sprite offsets
        }
        else
        {
            debugObject = new SceneObject();
            debugObject.setName(joint.name + "_debugDraw");
            debugObject.noExport = true;

            if(joint.jointType == "pulley")
            {
                var ropeA = new Sprite(lineJointName, layerId);
                var ropeB = new Sprite(lineJointName, layerId);
                var bar   = new Sprite(lineJointName, layerId);
                ropeA.isMainSprite = ropeB.isMainSprite = bar.isMainSprite = true;
                var boxA  = new Sprite("__wade_joint_end", layerId);
                var boxB  = new Sprite("__wade_joint_end", layerId);

                debugObject.addSprite(ropeA);
                debugObject.addSprite(ropeB);
                debugObject.addSprite(bar);
                debugObject.addSprite(boxA);
                debugObject.addSprite(boxB);

                posA = wade.vec2.add(objA.getPosition(), joint.localAnchorA || {x:0, y:0});
                posB = wade.vec2.add(objB.getPosition(), joint.localAnchorB || {x:0, y:0});

                debugObject.updateOffsets = function(posA, posB)
                {
                    // Bar between ground anchors
					var groundA = joint.groundAnchorA || {x: 0, y: 0};
					var groundB = joint.groundAnchorB || {x: 0, y: 0};
					var displacementVector = wade.vec2.sub(groundA, groundB);
                    var middle = wade.vec2.scale(wade.vec2.add(groundA, groundB), 0.5);
                    var barSprite = this.getSprite(2);
                    barSprite.setSize(4, wade.vec2.length(displacementVector));

                    this.setPosition(middle); // Set the object position to be the middle of the bar

                    // Rope between ground anchor A and object A
                    var displacementVector2 = wade.vec2.sub(groundA, posA);
                    var middleA = wade.vec2.scale(wade.vec2.add(groundA, posA), 0.5);
                    var ropeASprite = this.getSprite(0);
                    ropeASprite.setSize(4, wade.vec2.length(displacementVector2));
                    middleA = wade.vec2.sub(middleA, middle);

                    // Rope between ground anchor B and object B
                    var displacementVector3 = wade.vec2.sub(groundB, posB);
                    var middleB = wade.vec2.scale(wade.vec2.add(groundB, posB), 0.5);
                    var ropeBSprite = this.getSprite(1);
                    ropeBSprite.setSize(4, wade.vec2.length(displacementVector3));
                    middleB = wade.vec2.sub(middleB, middle);

                    // Offset of A
                    var offsetA = wade.vec2.sub(posA, middle);
                    // Offset of B
                    var offsetB = wade.vec2.sub(posB, middle);
                    this.setSpriteOffsets([middleA, middleB, {x:0, y:0}, offsetA, offsetB]);

                    // Fix rotations
                    var theta = Math.atan2(displacementVector.y, displacementVector.x);
                    barSprite.setRotation(theta - Math.PI/2);

                    theta = Math.atan2(displacementVector2.y, displacementVector2.x);
                    ropeASprite.setRotation(theta - Math.PI/2);

                    theta = Math.atan2(displacementVector3.y, displacementVector3.x);
                    ropeBSprite.setRotation(theta - Math.PI/2);

                };
                debugObject.updateOffsets(posA, posB); // Initialise offsets
                debugObject.onUpdate = function()
                {
                    posA = wade.vec2.add(objA.getPosition(), joint.localAnchorA || {x:0, y:0});
                    posB = wade.vec2.add(objB.getPosition(), joint.localAnchorB || {x:0, y:0});
                    debugObject.updateOffsets(posA, posB);
                };
            }
            else
            {
                jointA = new Sprite("__wade_joint_end", layerId);
                jointB = new Sprite("__wade_joint_end", layerId);
                var thread = new Sprite(lineJointName, layerId);
                thread.isMainSprite = true;

                debugObject.addSprite(jointA);
                debugObject.addSprite(jointB);
                debugObject.addSprite(thread);

                posA = wade.vec2.add(objA.getPosition(), joint.localAnchorA || {x:0, y:0});
                posB = wade.vec2.add(objB.getPosition(), joint.localAnchorB || {x:0, y:0});

                debugObject.updateOffsets = function(posA, posB)
                {
                    var displacementVector = wade.vec2.sub(posA, posB);
                    var middle = wade.vec2.scale(wade.vec2.add(posA, posB), 0.5);
                    var threadSprite = this.getSprite(2);
                    threadSprite.setSize(4, wade.vec2.length(displacementVector));
                    this.setSpriteOffsets([posA, posB, middle]);

                    // Calc rotation
                    var theta = Math.atan2(displacementVector.y, displacementVector.x);
                    thread.setRotation(theta - Math.PI/2);
                };
                debugObject.updateOffsets(posA, posB); // Initialise offsets
                debugObject.onUpdate = function()
                {
                    posA = wade.vec2.add(objA.getPosition(), joint.localAnchorA || {x:0, y:0});
                    posB = wade.vec2.add(objB.getPosition(), joint.localAnchorB || {x:0, y:0});
                    debugObject.updateOffsets(posA, posB);
                };
            }

            // Not all things have local anchors
            var initialOffsetA = joint.localAnchorA? {x: joint.localAnchorA.x, y: joint.localAnchorA.y} : {x:0, y:0};
            var initialOffsetB = joint.localAnchorB? {x: joint.localAnchorB.x, y: joint.localAnchorB.y} : {x:0, y:0};
            var rotatedOffsetA = wade.vec2.rotate(initialOffsetA, objA.getRotation());
            var rotatedOffsetB = wade.vec2.rotate(initialOffsetB, objB.getRotation());
            wade.vec2.addInPlace(rotatedOffsetA, objA.getPosition());
            wade.vec2.addInPlace(rotatedOffsetB, objB.getPosition());
            debugObject.updateOffsets(rotatedOffsetA, rotatedOffsetB);
            wade.addSceneObject(debugObject, false);
            return debugObject;
        }
    };

	// ------------------------------------------------------------------------------------------------------------------
	// Undocumented (i.e. non-exposed) functions for internal use only
	// ------------------------------------------------------------------------------------------------------------------

    this.createBody = function(bodyDef)
    {
        initialize();
        return this.world.createBody(bodyDef);
    };

    this.wadeToBox = function(position)
	{
		return ({x:position.x/scale,y:-1*position.y/scale});
	};

	this.wadeToBoxScalar = function(value)
	{
		return (value/scale);
	};

	this.boxToWade = function(position)
	{
		return ({x:position.x*scale, y:-1*position.y*scale});
	};

	this.boxToWadeScalar = function(value)
	{
		return (value*scale);
	};

    this.getScale = function()
    {
        return scale;
    };

};

/**
 * This is the object used to interact with the physics engine
 * @type {Wade_physics}
 */
wade.physics = new Wade_physics();
