Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.weld = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'weld'};

    if(!sceneObjectA || !sceneObjectB)
    {
        return wade.error("Failed to create a weld joint - scene object parameters cannot be null");
    }
    if(typeof(sceneObjectA) == "string")
    {
        sceneObjectA = _[sceneObjectA];
    }
    if(typeof(sceneObjectB) == "string")
    {
        sceneObjectB = _[sceneObjectB];
    }

    var physicsA = sceneObjectA.getBehavior("PhysicsObject");
    var physicsB = sceneObjectB.getBehavior("PhysicsObject");
    if(!physicsA || !physicsB)
    {
        return wade.error("Failed to create a weld joint - both scene objects must have an instance of PhysicsObject");
    }
    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var weldJointDef = new box2d.b2WeldJointDef();
    var world = wade.physics.world.getB2DWorld();

    weldJointDef.Initialize(bodyA, bodyB, bodyA.GetWorldCenter());
    weldJointDef.collideConnected = options.collideConnected || false;
    weldJointDef.frequencyHz = options.frequencyHz || 0;
    weldJointDef.dampingRatio = options.dampingRatio || 0;
    weldJointDef.referenceAngle = -1*options.referenceAngle || 0;

    if (options.localAnchorA)
    {
        var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
        weldJointDef.localAnchorA.Set(boxAnchorA.x,boxAnchorA.y);
    }
    if (options.localAnchorB)
    {
        var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
        weldJointDef.localAnchorA.Set(boxAnchorB.x,boxAnchorB.y);
    }
    weldJointDef.userData = joint;
    var weldJoint = world.CreateJoint(weldJointDef);

    joint.getB2dJoint = function()
    {
        return weldJoint;
    };

    joint.setVisible = function(dontDraw)
    {
        var visibleObject = wade.physics.debugDrawJoint(this, !dontDraw);
        if(visibleObject && !dontDraw)
        {
            visibleObject.listenFor("onUpdate");
        }
    };

    Object.defineProperty(joint, "sceneObjectA",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return sceneObjectA.getName();
        },
        set: function()
        {
            return wade.warn('It is not possible to change the objects a joint is connected to at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, "sceneObjectB",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return sceneObjectB.getName();
        },
        set: function()
        {
            return wade.warn('It is not possible to change the objects a joint is connected to at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, 'collideConnected',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return weldJoint.GetCollideConnected();
        },
        set: function()
        {
            return wade.warn("It's not possible to change whether both scene objects collide with each other or not at run time");
        }
    });

    Object.defineProperty(joint, 'reactionForce',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.timeStep);
            var forceVector = weldJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
            return wade.physics.boxToWade(forceVector);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction force. This force is merely a result of other factors like joint movement");
        }
    });

    Object.defineProperty(joint, 'reactionTorque',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.timeStep);
            return -1*weldJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'frequency',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return weldJoint.GetFrequency();
        },
        set: function(frequency)
        {
            weldJoint.SetFrequency(frequency);
        }
    });

    Object.defineProperty(joint, 'dampingRatio',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return weldJoint.GetDampingRatio();
        },
        set: function(frequency)
        {
            weldJoint.SetDampingRatio(frequency);
        }
    });

    weldJointDef.userData = joint;
    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.weld = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove weld joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true); // I don't like this
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};