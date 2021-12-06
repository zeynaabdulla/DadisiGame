Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.revolute = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'revolute'};

    if(!sceneObjectA || !sceneObjectB)
    {
        return wade.error("Failed to create a revolute joint - scene object parameters cannot be null");
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
        return wade.error("Failed to create a revolute joint - both scene objects must have an instance of PhysicsObject");
    }
    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var revoluteJointDef = new box2d.b2RevoluteJointDef();
    var world = wade.physics.world.getB2DWorld();

    revoluteJointDef.Initialize(bodyA,
                                bodyB,
                                bodyA.GetWorldCenter());

    revoluteJointDef.bodyA = bodyA;
    revoluteJointDef.bodyB = bodyB;
    options.localAnchorA = options.localAnchorA || {x:0, y:0};
    options.localAnchorB = options.localAnchorB || {x:0, y:0};


    if (options.localAnchorA)
    {
        var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
        revoluteJointDef.localAnchorA.Set(boxAnchorA.x,boxAnchorA.y);
    }

    if (options.localAnchorB)
    {
        var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
        revoluteJointDef.localAnchorB.Set(boxAnchorB.x,boxAnchorB.y);
    }


    /*wade.vec2.addInPlace(options.localAnchorB, wade.vec2.sub(sceneObjectB.getPosition(), sceneObjectA.getPosition()));

    var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
    revoluteJointDef.localAnchorA.Set(boxAnchorA.x, boxAnchorA.y);

    var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
    revoluteJointDef.localAnchorB.Set(-boxAnchorB.x, -boxAnchorB.y);*/

    revoluteJointDef.collideConnected = options.collideConnected || false;
    revoluteJointDef.enableLimit      = options.enableLimit || false;
    revoluteJointDef.enableMotor      = options.enableMotor || false;
    revoluteJointDef.lowerAngle       = options.lowerAngle || 0;
    revoluteJointDef.upperAngle       = options.upperAngle || 0;
    revoluteJointDef.maxMotorTorque   = options.maxMotorTorque || 0;
    revoluteJointDef.motorSpeed       = options.motorSpeed || 0;
    revoluteJointDef.userData         = joint;

    // Reference angle
    var refVec = wade.vec2.sub(revoluteJointDef.localAnchorB, revoluteJointDef.localAnchorA);
    refVec = Math.atan2(refVec.y, refVec.x);

    options.referenceAngle = options.referenceAngle || 0;
    revoluteJointDef.referenceAngle  = -1*options.referenceAngle + refVec;

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

    Object.defineProperty(joint, "localAnchorA",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = revoluteJoint.GetLocalAnchorA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn('It is not possible to change anchor point A at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, "localAnchorB",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = revoluteJoint.GetLocalAnchorB(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn('It is not possible to change anchor point B at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, 'collideConnected',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return revoluteJoint.GetCollideConnected();
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
            var forceVector = revoluteJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*revoluteJoint.GetReactionTorque(inverseTimeStep);
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
            return  -1*revoluteJoint.GetReferenceAngle();
        },
        set: function()
        {
            return wade.warn("The reference angle is the bodyA angle minus the bodyB angle, it is not possible to directly set this value");
        }
    });

    Object.defineProperty(joint, 'jointAngle',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*revoluteJoint.GetJointAngle();
        },
        set: function()
        {
            return wade.warn("The joint angle cannot be specified, however you can enable a motor to change the angle");
        }
    });

    Object.defineProperty(joint, 'jointSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*revoluteJoint.GetJointSpeed();
        },
        set: function()
        {
            return wade.warn("Joint speed cannot be set directly. However a motor on the joint can be used to indirectly change this value");
        }
    });

    Object.defineProperty(joint, 'motorEnabled',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return revoluteJoint.IsMotorEnabled();
        },
        set: function(value)
        {
            revoluteJoint.EnableMotor(value);
        }
    });

    Object.defineProperty(joint, 'motorSpeed',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*revoluteJoint.GetMotorSpeed();
        },
        set: function(speed)
        {
            revoluteJoint.SetMotorSpeed(-1*speed);
        }
    });

    Object.defineProperty(joint, 'motorTorque',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.timeStep);
            return -1*revoluteJoint.GetMotorTorque(inverseTimeStep);
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
            return revoluteJoint.GetMaxMotorTorque();
        },
        set: function(torque)
        {
            revoluteJoint.SetMaxMotorTorque(torque);
        }
    });

    Object.defineProperty(joint, 'limitEnabled',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return revoluteJoint.IsLimitEnabled();
        },
        set: function(value)
        {
            revoluteJoint.EnableLimit(value);
        }
    });

    Object.defineProperty(joint, 'lowerLimit',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*revoluteJoint.GetLowerLimit();
        },
        set: function()
        {
            return wade.warn("Join limits cannot be set independently, please see jointLimits.set");
        }
    });

    Object.defineProperty(joint, 'upperLimit',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return -1*revoluteJoint.GetUpperLimit();
        },
        set: function()
        {
            return wade.warn("Join limits cannot be set independently, please see jointLimits.set");
        }
    });

    Object.defineProperty(joint, 'jointLimits',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return {lower:-1*revoluteJoint.GetLowerLimit(), upper:-1*revoluteJoint.GetUpperLimit()};
        },
        set: function(lower, upper)
        {
            return revoluteJoint.SetLimits(-1*lower,-1*upper);
        }
    });


    var revoluteJoint = world.CreateJoint(revoluteJointDef);

    joint.getB2dJoint = function()
    {
        return revoluteJoint;
    };

    joint.setVisible = function(dontDraw)
    {
        var visibleObject = wade.physics.debugDrawJoint(this, !dontDraw);
        if(visibleObject && !dontDraw)
        {
            visibleObject.listenFor("onUpdate");
        }
    };

    revoluteJointDef.userData = joint;
    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.revolute = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove revolute joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true);
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};
