App = function() {
    
        this.load = function()
        {
          wade.loadImage('back.png');
        };

        this.init = function() {
            var gridSize = {x: 4, y: 2};
            var cellSize = {x: 150, y: 200};
            wade.addSceneObject(card);
            this.init = function()
            {
                for (var i=0; i < gridSize.x; i++)
                {
                    for (var j=0; j < gridSize.y; j++)
                    {
                        this.createCard(i, j);
                    }
                }
            };
            
        this.createCard = function(i, j)
        {
        var x = (i - gridSize.x/2 + 0.5) * cellSize.x;
        var y = (j - gridSize.y/2 + 0.5) * cellSize.y;
        var sprite = new Sprite('back.png');
        var card = new SceneObject(sprite, 0, x, y);
        wade.addSceneObject(card);
        };
        };
    
    };
