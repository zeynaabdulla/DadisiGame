Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.wheel = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'wheel'};

    if(!sceneObjectA || !sceneObjectB)
    {
        return wade.error("Failed to create a wheel joint - scene object parameters cannot be null");
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
        return wade.error("Failed to create a wheel joint - both scene objects must have an instance of PhysicsObject");
    }

    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var wheelJointDef = new box2d.b2WheelJointDef();
    var world = wade.physics.world.getB2DWorld();

    wheelJointDef.Initialize(bodyA,bodyB,bodyA.GetWorldCenter(),new box2d.b2Vec2(1, 0));

    options.localAnchorA = options.localAnchorA || {x:0, y:0};
    var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
    wheelJointDef.localAnchorA.Set(boxAnchorA.x,boxAnchorA.y);

    options.localAnchorB = options.localAnchorB || {x:0, y:0};
    var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
    wheelJointDef.localAnchorA.Set(boxAnchorB.x,boxAnchorB.y);

    options.localAxisA = options.localAxisA || {x:0, y:0};
    var axisA = wade.physics.wadeToBox(options.localAxisA);
    wade.vec2.normalizeInPlace(axisA);
    wheelJointDef.localAxisA = new box2d.b2Vec2(axisA.x, axisA.y);


    wheelJointDef.bodyA = bodyA;
    wheelJointDef.bodyB = bodyB;
    wheelJointDef.collideConnected = options.collideConnected || false;
    wheelJointDef.enableMotor = options.enableMotor || false;
    wheelJointDef.maxMotorTorque = options.maxMotorTorque || 0;
    wheelJointDef.motorSpeed = options.motorSpeed || 0;
    wheelJointDef.frequencyHz = options.frequencyHz || 0;
    wheelJointDef.dampingRatio = options.dampingRatio || 0;

    wheelJointDef.userData = joint;
    var wheelJoint = world.CreateJoint(wheelJointDef);

    joint.getB2dJoint = function()
    {
        return wheelJoint;
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

    Object.defineProperty(joint, 'anchorA',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = wheelJoint.GetAnchorA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn("It's not possible to change the anchor at run time");
        }
    });

    Object.defineProperty(joint, 'anchorB',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = wheelJoint.GetAnchorB(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn("It's not possible to change the anchor at run time");
        }
    });

    Object.defineProperty(joint, 'collideConnected',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wheelJoint.GetCollideConnected();
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
            var forceVector = wheelJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*wheelJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'localAxisA',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = wheelJoint.GetLocalAxisA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the local axis");
        }
    });

    Object.defineProperty(joint, 'jointTranslation',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(wheelJoint.GetJointTranslation());
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
            return wade.physics.boxToWadeScalar(wheelJoint.GetJointSpeed());
        },
        set: function()
        {
            return wade.warn("It's not possible to set the joint speed, look at motorSpeed");
        }
    });

    Object.defineProperty(joint, 'motorEnabled',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wheelJoint.IsMotorEnabled();
        },
        set: function(value)
        {
            wheelJoint.EnableMotor(value);
        }
    });

    Object.defineProperty(joint, 'motorSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*wheelJoint.GetMotorSpeed();
        },
        set: function(speed)
        {
            wheelJoint.SetMotorSpeed(-1*speed);
        }
    });

    Object.defineProperty(joint, 'motorTorque',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.timeStep);
            return -1*wheelJoint.GetMotorTorque(inverseTimeStep);
        },
        set: function(torque)
        {
            return wade.warn("Motor torque cannot be set. See maxMotorTorque, this is the maximum power the motor can produce");
        }
    });

    Object.defineProperty(joint, 'maxMotorTorque',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wheelJoint.GetMaxMotorTorque();
        },
        set: function(torque)
        {
            wheelJoint.SetMaxMotorTorque(torque);
        }
    });

    Object.defineProperty(joint, 'frequency',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wheelJoint.GetSpringFrequencyHz();
        },
        set: function(frequency)
        {
            wheelJoint.SetSpringFrequencyHz(frequency);
        }
    });

    Object.defineProperty(joint, 'dampingRatio',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wheelJoint.GetSpringDampingRatio();
        },
        set: function(ratio)
        {
            wheelJoint.SetSpringDampingRatio(ratio);
        }
    });

    Object.defineProperty(joint, 'prismaticJointTranslation',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(wheelJoint.GetPrismaticJointTranslation());
        },
        set: function()
        {
            return wade.warn("You cannot set the joint translation, only get it");
        }
    });

    Object.defineProperty(joint, 'prismaticJointSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return wade.physics.boxToWadeScalar(wheelJoint.GetPrismaticJointTranslation());
        },
        set: function()
        {
            return wade.warn("You cannot set the joint translation, only get it");
        }
    });

    Object.defineProperty(joint, 'revoluteJointAngle',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*wheelJoint.GetRevoluteJointAngle();
        },
        set: function()
        {
            return wade.warn("You cannot set the wheel joint angle directly");
        }
    });

    Object.defineProperty(joint, 'revoluteJointSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*wheelJoint.GetRevoluteJointSpeed();
        },
        set: function()
        {
            return wade.warn("You cannot set the speed of the wheel joint");
        }
    });


    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.wheel = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove wheel joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true); // I don't like this
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};