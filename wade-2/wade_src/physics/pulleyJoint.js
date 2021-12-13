Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.pulley = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'pulley'};

    if(!sceneObjectA || !sceneObjectB)
    {
        return wade.error("Failed to create a pulley joint - scene object parameters cannot be null");
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
        return wade.error("Failed to create a pulley joint - both scene objects must have an instance of PhysicsObject");
    }

    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var pulleyJointDef = new box2d.b2PulleyJointDef();
    var world = wade.physics.world.getB2DWorld();

    if (options.groundAnchorA == null || options.groundAnchorB == null)
    {
        wade.warn('Creating pulley with null ground anchors');
    }

    if (!options.groundAnchorA)
    {
        options.groundAnchorA = {x: 0, y: 0};
    }
    if (!options.groundAnchorB)
    {
        options.groundAnchorA = {x: 0, y: 0};
    }

    var anchorA = bodyA.GetWorldCenter();
    var anchorB = bodyB.GetWorldCenter();

    options.ratio  = options.ratio || 1;
    options.groundAnchorA = wade.physics.wadeToBox(options.groundAnchorA);
    options.groundAnchorB = wade.physics.wadeToBox(options.groundAnchorB);

    pulleyJointDef.collideConnected = !!options.collideConnected;
    pulleyJointDef.userData = joint;

    pulleyJointDef.Initialize(bodyA, bodyB, options.groundAnchorA, options.groundAnchorB, anchorA, anchorB, options.ratio);

    var pulleyJoint = world.CreateJoint(pulleyJointDef);

    joint.getB2dJoint = function()
    {
        return pulleyJoint;
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
            return pulleyJoint.GetCollideConnected();
        },
        set: function()
        {
            return wade.warn("It's not possible to change whether both scene objects collide with each other or not at run time");
        }
    });

    Object.defineProperty(joint, 'groundAnchorA',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = pulleyJoint.GetGroundAnchorA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the ground anchor at run time");
        }
    });

    Object.defineProperty(joint, 'groundAnchorB',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = pulleyJoint.GetGroundAnchorB(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the ground anchor at run time");
        }
    });

    Object.defineProperty(joint, 'reactionForce',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.timeStep);
            var forceVector = pulleyJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*pulleyJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'lengthA',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxLength = pulleyJoint.GetLengthA();
            return wade.physics.boxToWadeScalar(boxLength);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the length of the segment attached to bodyA");
        }
    });

    Object.defineProperty(joint, 'lengthB',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxLength = pulleyJoint.GetLengthB();
            return wade.physics.boxToWadeScalar(boxLength);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the length of the segment attached to bodyB");
        }
    });

    Object.defineProperty(joint, 'ratio',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return pulleyJoint.GetRatio();
        },
        set: function(value)
        {
            return pulleyJoint.SetRatio(value);
        }
    });
    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.pulley = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove pulley joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true);
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};