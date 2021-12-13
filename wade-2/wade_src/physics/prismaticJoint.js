Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.prismatic = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'prismatic'};

    if(!sceneObjectA || !sceneObjectB)
    {
        return wade.error("Failed to create a prismatic joint - scene object parameters cannot be null");
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
        return wade.error("Failed to create a prismatic joint - both scene objects must have an instance of PhysicsObject");
    }
    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var prismaticJointDef = new box2d.b2PrismaticJointDef();
    var world = wade.physics.world.getB2DWorld();

    options.localAnchorA = options.localAnchorA || {x:0, y:0};
    var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
    prismaticJointDef.localAnchorA.Set(boxAnchorA.x,boxAnchorA.y);

    options.localAnchorB = options.localAnchorB || {x:0, y:0};
    var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
    prismaticJointDef.localAnchorA.Set(boxAnchorB.x,boxAnchorB.y);

    options.localAxisA = options.localAxisA || {x:0, y:0};
    var axisA = wade.physics.wadeToBox(options.localAxisA);
    wade.vec2.normalizeInPlace(axisA);
    prismaticJointDef.localAxisA = new box2d.b2Vec2(axisA.x, axisA.y);

    prismaticJointDef.bodyA = bodyA;
    prismaticJointDef.bodyB = bodyB;
    prismaticJointDef.collideConnected = options.collideConnected || false;
    prismaticJointDef.enableLimit = options.enableLimit || false;
    prismaticJointDef.enableMotor = options.enableMotor || false;
    prismaticJointDef.lowerTranslation = wade.physics.wadeToBoxScalar(options.lowerTranslation) || 0;
    prismaticJointDef.upperTranslation = wade.physics.wadeToBoxScalar(options.upperTranslation) || 0;
    prismaticJointDef.maxMotorForce = options.maxMotorForce || 0;
    prismaticJointDef.motorSpeed = options.motorSpeed || 0;
    prismaticJointDef.referenceAngle = -1*options.referenceAngle || 0;
    var prismaticJoint = world.CreateJoint(prismaticJointDef);

    joint.getB2dJoint = function()
    {
        return prismaticJoint;
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

    Object.defineProperty(joint, "bodyA",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return bodyA;
        },
        set: function()
        {
            return wade.warn('It is not possible to change the body a joint is connected to at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, "bodyB",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return bodyB;
        },
        set: function()
        {
            return wade.warn('It is not possible to change the body a joint is connected to at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, "anchorA",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = prismaticJoint.GetAnchorA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn('It is not possible to change the anchor of a joint at runtime. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, "anchorB",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = prismaticJoint.GetAnchorB(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn('It is not possible to change the anchor of a joint at runtime. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, 'collideConnected',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return prismaticJoint.GetCollideConnected();
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
            var forceVector = prismaticJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*prismaticJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'referenceAngle',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return  -1*prismaticJoint.GetReferenceAngle();
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reference angle");
        }
    });

    Object.defineProperty(joint, 'localAxisA',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAxis = prismaticJoint.GetLocalAxisA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAxis);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the local x axis");
        }
    });

    Object.defineProperty(joint, 'jointTranslation',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(prismaticJoint.GetJointTranslation());
        },
        set: function()
        {
            return wade.warn("It's not possible to set the joint translation");
        }
    });

    Object.defineProperty(joint, 'jointSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(prismaticJoint.GetJointSpeed());
        },
        set: function()
        {
            return wade.warn("It's not possible to set the joint speed");
        }
    });

    Object.defineProperty(joint, 'motorEnabled',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return prismaticJoint.IsMotorEnabled();
        },
        set: function(value)
        {
            prismaticJoint.EnableMotor(value);
        }
    });

    Object.defineProperty(joint, 'motorSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return prismaticJoint.GetMotorSpeed();
        },
        set: function(speed)
        {
            prismaticJoint.SetMotorSpeed(speed);
        }
    });

    Object.defineProperty(joint, 'motorForce',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.getB2DWorldSettings().timeStep);
            return prismaticJoint.GetMotorForce(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to manually set the force applied to a motor");
        }
    });

    Object.defineProperty(joint, 'maxMotorForce',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return prismaticJoint.GetMaxMotorForce();
        },
        set: function(force)
        {
            prismaticJoint.SetMaxMotorForce(force);
        }
    });

    Object.defineProperty(joint, 'limitEnabled',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return prismaticJoint.IsLimitEnabled();
        },
        set: function(value)
        {
            prismaticJoint.EnableLimit(value);
        }
    });

    Object.defineProperty(joint, 'lowerLimit',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(prismaticJoint.GetLowerLimit());
        },
        set: function()
        {
            return wade.warn("See setJointLimits to set limits");
        }
    });

    Object.defineProperty(joint, 'upperLimit',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(prismaticJoint.GetUpperLimit());
        },
        set: function()
        {
            return wade.warn("See setJointLimits to set limits");
        }
    });

    Object.defineProperty(joint, 'jointLimits',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.warn("See upperLimit and lowerLimit functions to get the limits");
        },
        set: function(lower, upper)
        {
            var low = wade.physics.wadeToBoxScalar(lower);
            var up = wade.physics.wadeToBoxScalar(upper);
            prismaticJoint.SetLimits(low,up);
        }
    });

    prismaticJoint.userData = joint;
    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.prismatic = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove prismatic joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true); // I don't like this
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};