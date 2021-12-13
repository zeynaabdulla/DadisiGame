var config = {
	type: Phaser.AUTO,
	width: 1900,
  height: 950,
	pixelArt: true,
  scene: {
      preload: preload,
      create: create,
		update: update
  }
};

let game = new Phaser.Game(config);

let player;
let cursors;
let tileSize = 32;

function preload ()
{

    this.load.image('background', 'blue-background.jpg');
    this.load.image('player', 'http://labs.phaser.io/assets/sprites/wabbit.png');
    this.load.image('yellow', 'http://labs.phaser.io/assets/particles/yellow.png');
}

function create ()
{
    let background = this.add.image(1900/2, 950/2, 'background');
		background.x = background.displayWidth / 2;
  	background.y = background.displayHeight / 2;

  	xLimit = background.displayWidth; 
  	yLimit = background.displayHeight;

    let particles = this.add.particles('yellow');

    let emitter = particles.createEmitter({
        speed: 200,
        scale: { start: 1, end: 0 },
        blendMode: 'ADD'
    });

    player = this.add.image(640, 360, 'player');
		player.setScale(2);

    emitter.startFollow(player);

	cursors = this.input.keyboard.createCursorKeys();

}

function gridMovement(object, direction) {
	const dist = tileSize;

	switch (direction) {
		case "left":
			object.x -= tileSize;
			break;
		case "right":
			object.x += tileSize;
			break;
		case "up":
			object.y -= tileSize;
			break;
		case "down":
			object.y += tileSize;
			break;
	}
	object.x = Phaser.Math.Snap.To(object.x, dist);
	object.y = Phaser.Math.Snap.To(object.y, dist);
}

function update(delta) {
  if (cursors.left.isDown) {
	  gridMovement(player, "left");
  }
  else if (cursors.right.isDown) {
	  gridMovement(player, "right");
  }
  else if (cursors.up.isDown) {
	  gridMovement(player, "up");
  }
  else if (cursors.down.isDown) {
	  gridMovement(player, "down");
  }
}
