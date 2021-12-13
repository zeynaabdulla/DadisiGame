Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.rope = function(sceneObjectA, sceneObjectB, parameters)
{
    var joint = {jointType: 'rope'};

    if(!sceneObjectA || !sceneObjectB)
    {
        return wade.error("Failed to create a rope joint - scene object parameters cannot be null");
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
        return wade.error("Failed to create a rope joint - both scene objects must have an instance of PhysicsObject");
    }
    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    var options = wade.cloneObject(parameters);
    var ropeJointDef = new box2d.b2RopeJointDef();
    var world = wade.physics.world.getB2DWorld();

    ropeJointDef.bodyA = bodyA;
    ropeJointDef.bodyB = bodyB;

    options.localAnchorA = options.localAnchorA || {x:0, y:0};
    var boxAnchorA = wade.physics.wadeToBox(options.localAnchorA);
    ropeJointDef.localAnchorA.Set(boxAnchorA.x,boxAnchorA.y);

    options.localAnchorB = options.localAnchorB || {x:0, y:0};
    var boxAnchorB = wade.physics.wadeToBox(options.localAnchorB);
    ropeJointDef.localAnchorA.Set(boxAnchorB.x,boxAnchorB.y);

    ropeJointDef.collideConnected = options.collideConnected || false;
    ropeJointDef.maxLength = wade.physics.wadeToBoxScalar(options.maxLength) || 0;

    var ropeJoint = world.CreateJoint(ropeJointDef);
    ropeJoint.userData = joint;

    joint.getB2dJoint = function()
    {
        return ropeJoint;
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

    Object.defineProperty(joint, "anchorA",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = ropeJoint.GetAnchorA(new box2d.b2Vec2());
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
            var boxAnchor = ropeJoint.GetAnchorB(new box2d.b2Vec2());
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
            return ropeJoint.GetCollideConnected();
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
            var forceVector = ropeJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*ropeJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'maxLength',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxLength = ropeJoint.GetMaxLength();
            return wade.physics.boxToWadeScalar(boxLength)
        },
        set: function(length)
        {
            var boxLength = wade.physics.wadeToBoxScalar(length);
            ropeJoint.SetMaxLength(boxLength);
        }
    });

    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.rope = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove rope joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true); // I don't like this
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};