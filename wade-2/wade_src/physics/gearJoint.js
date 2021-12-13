Wade_physics.prototype._addJoint_ = Wade_physics.prototype._addJoint_ || {};
Wade_physics.prototype._addJoint_.gear = function(jointA, jointB, parameters)
{
    var joint = {jointType: 'gear'};

    if(!jointA || !jointB)
    {
        return wade.error("Failed to create a gear joint - jointA and jointB parameters cannot be null");
    }
    if(typeof(jointA) == "string")
    {
        jointA = _[jointA];
    }
    if(typeof(jointB) == "string")
    {
        jointB = _[jointB];
    }

    var options = wade.cloneObject(parameters);
    var gearJointDef = new box2d.b2GearJointDef();
    var world = wade.physics.world.getB2DWorld();
    var objA = wade.getSceneObject(jointA.sceneObjectA);
    var objB = wade.getSceneObject(jointB.sceneObjectA);

    var physicsA = objA.getBehavior("PhysicsObject");
    var physicsB = objB.getBehavior("PhysicsObject");
    if(!physicsA || !physicsB)
    {
        return wade.error("Failed to create a gear joint - both body options must have an instance of PhysicsObject");
    }
    var bodyA = physicsA.getB2dBody();
    var bodyB = physicsB.getB2dBody();

    gearJointDef.bodyA = bodyA;
    gearJointDef.bodyB = bodyB;
    gearJointDef.joint1 = jointA.getB2dJoint();
    gearJointDef.joint2 = jointB.getB2dJoint();
    gearJointDef.ratio = options.ratio || 1;
    gearJointDef.collideConnected = false;
    gearJointDef.userData = joint;
    var gearJoint = world.CreateJoint(gearJointDef);

    joint.getB2dJoint = function()
    {
        return gearJoint;
    };

    joint.setVisible = function(dontDraw)
    {
        var visibleObject = wade.physics.debugDrawJoint(this, !dontDraw);
        if(visibleObject && !dontDraw)
        {
            visibleObject.listenFor("onUpdate");
        }
    };

    Object.defineProperty(joint, 'joint1',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return jointA.name;
        },
        set: function()
        {
            return wade.warn("Cannot change joint");
        }
    });

    Object.defineProperty(joint, 'joint2',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return jointB.name;
        },
        set: function()
        {
            return wade.warn("Cannot change joint");
        }
    });

    Object.defineProperty(joint, "anchorA",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = gearJoint.GetAnchorA(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn('It is not possible to change anchor point A at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, "anchorB",
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var boxAnchor = gearJoint.GetAnchorB(new box2d.b2Vec2());
            return wade.physics.boxToWade(boxAnchor);
        },
        set: function()
        {
            return wade.warn('It is not possible to change anchor point B at run-time. Destroy and recreate the joint instead');
        }
    });

    Object.defineProperty(joint, 'reactionForce',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            var inverseTimeStep = 1/(wade.physics.world.timeStep);
            var forceVector = gearJoint.GetReactionForce(inverseTimeStep,new box2d.b2Vec2());
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
            return -1*gearJoint.GetReactionTorque(inverseTimeStep);
        },
        set: function()
        {
            return wade.warn("It's not possible to set the reaction torque");
        }
    });

    Object.defineProperty(joint, 'ratio',
    {
        enumerable: true,
        configurable: true,
        get: function()
        {
            return gearJoint.GetRatio();
        },
        set: function(value)
        {
            return gearJoint.SetRatio(value);
        }
    });

    return joint;
};

Wade_physics.prototype._removeJoint_ = Wade_physics.prototype._removeJoint_ || {};
Wade_physics.prototype._removeJoint_.gear = function(myJoint)
{
    if(!myJoint)
    {
        return wade.warn("Unable to remove gear joint - the joint interface object provided to this function is a false value");
    }
    myJoint.setVisible(true);
    var b2dJoint = myJoint.getB2dJoint();
    var world = wade.physics.world.getB2DWorld();
    world.DestroyJoint(b2dJoint);
};