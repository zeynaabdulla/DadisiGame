wade.proceduralImages = new function()
{
    var imageNames = [];

    this.init = function()
    {
        var size = 32;
        var sprite = new Sprite(null, null);
        sprite.setSize(size, size);

        // square
        sprite.setDrawFunction(wade.drawFunctions.solidFill_('white'));
        sprite.drawToImage('procedural_square', true);
        imageNames.push('procedural_square');

        // square borders
        sprite.setDrawFunction(wade.drawFunctions.drawRect_('white', 3));
        sprite.drawToImage('procedural_square_border', true);
        sprite.setDrawFunction(wade.drawFunctions.drawRect_('red', 2));
        sprite.drawToImage('procedural_square_border', false);
        imageNames.push('procedural_square_border');

        // circle
        sprite.setDrawFunction(function(context)
        {
            var pos = this.getPosition();
            context.closePath();
            context.beginPath();
            context.fillStyle = 'white';
            context.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2, false);
            context.fill();
        });
        sprite.drawToImage('procedural_circle', true);
        imageNames.push('procedural_circle');

        // fading circle
        sprite.setDrawFunction(wade.drawFunctions.radialGradientCircle_(['white'], 'rgba(255, 255, 255, 0)'));
        sprite.drawToImage('procedural_fadingCircle', true);
        imageNames.push('procedural_fadingCircle');

        // star
        sprite.setDrawFunction(function(context)
        {
            var pos = this.getPosition();
            context.closePath();
            context.beginPath();
            context.fillStyle = 'white';
            context.moveTo(-size/6 + pos.x, -size/6 + pos.y);
            context.lineTo(0 + pos.x, -size/2 + pos.y);
            context.lineTo(size/6 + pos.x, -size/6 + pos.y);
            context.lineTo(size/2 + pos.x, 0 + pos.y);
            context.lineTo(size/6 + pos.x, size/6 + pos.y);
            context.lineTo(0 + pos.x, size/2 + pos.y);
            context.lineTo(-size/6 + pos.x, size/6 + pos.y);
            context.lineTo(-size/2 + pos.x, 0 + pos.y);
            context.lineTo(-size/6 + pos.x, -size/6 + pos.y);
            context.fill();
        });
        sprite.drawToImage('procedural_star', true);
        imageNames.push('procedural_star');
    };

    this.list = function()
    {
        return wade.cloneArray(imageNames);
    };
}();
