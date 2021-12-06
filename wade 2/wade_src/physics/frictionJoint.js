Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.friction = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'friction'};

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
        return wade.error("Failed to create a friction joint - both scene objects must have an instance of PhysicsObject");
    }

    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var frictionJointDef = new box2d.b2FrictionJointDef();
    var world = wade.physics.world.getB2DWorld();

    frictionJointDef.Initialize(bodyA,bodyB,bodyA.GetWorldCenter());

    if (options.localAnchorA)
    {
        var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
        frictionJointDef.localAnchorA.Set(boxAnchorA.x,boxAnchorA.y);
    }

    if (options.localAnchorB)
    {
        var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
        frictionJointDef.localAnchorA.Set(boxAnchorB.x,boxAnchorB.y);
    }

    frictionJointDef.collideConnected = options.collideConnected || false;
    frictionJointDef.bodyA = bodyA;
    frictionJointDef.bodyB = bodyB;
    frictionJointDef.maxForce = options.maxForce || 0;
    frictionJointDef.maxTorque = options.maxTorque || 0;

    frictionJointDef.userData = joint;
    var frictionJoint = world.CreateJoint(frictionJointDef);

    joint.getB2dJoint = function()
    {
        return frictionJoint;
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
            var boxAnchor = frictionJoint.GetAnchorA(new box2d.b2Vec2());
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
            var boxAnchor = frictionJoint.GetAnchorB(new box2d.b2Vec2());
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
            return frictionJoint.GetCollideConnected();
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
            var forceVector = frictionJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*frictionJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'maxForce',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return frictionJoint.GetMaxForce();
        },
        set: function(force)
        {
            return frictionJoint.SetMaxForce(force);
        }
    });

    Object.defineProperty(joint, 'maxTorque',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return frictionJoint.GetMaxTorque();
        },
        set: function(torque)
        {
            frictionJoint.SetMaxTorque(torque);
        }
    });

    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.friction = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove friction joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true); // I don't like this
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};