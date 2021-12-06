// Your game config
var config = {
	type: Phaser.AUTO,
	width: 960,
  height: 960,
	pixelArt: true,
  scene: {
    preload: preload,
    create: create,
		update: update
  },
	plugins: {
		scene: [
			{
				key: "gridEngine",
				plugin: GridEngine,
				mapping: "gridEngine",
			},
		],
	}
};

const game = new Phaser.Game(config);
let playerSprite;

function preload() {
  this.load.image("tiles", "first-area.png");
  this.load.tilemapTiledJSON("first-area-data", "first-area.json");
  this.load.image('player', 'assets/front_maya.png');
  this.load.image('goal', 'assets/paper.png');
	/*
  this.load.spritesheet("player", "assets/MayaSpritesheet.png", {
    frameWidth: 32,
    frameHeight: 64,
  });
	*/
}

function create() {
  const firstAreaTileMap = this.make.tilemap({ key: "first-area-data" });
  firstAreaTileMap.addTilesetImage("First Area", "tiles");
  for (let i = 0; i < firstAreaTileMap.layers.length; i++) {
    const layer = firstAreaTileMap.createLayer(i, "First Area", 0, 0);
    layer.scale = 3;
  }
  playerSprite = this.add.sprite(0, 0, "player");
  playerSprite.scale = 1.5;
  this.cameras.main.startFollow(playerSprite, true);
  this.cameras.main.setFollowOffset(-playerSprite.width, -playerSprite.height);

  const gridEngineConfig = {
  	characters: [
      {
        id: "player",
        sprite: playerSprite,
        // walkingAnimationMapping: 6,
        startPosition: { x: 5, y: 5 },
      },
    ],
  };

  this.gridEngine.create(firstAreaTileMap, gridEngineConfig);
  const background = this.add.image(480, 480, 'tiles');
	background.scale = 1.5;
  const goalSprite = this.add.image(430, 430, "goal");
	goalSprite.scale = 1.5;

}

function update() {
	if (playerSprite.x > 407 && playerSprite.y < 409 && playerSprite.y > 397 && playerSprite.y < 399) {
			window.location.href = "wade-2/index.html";
	}
  const cursors = this.input.keyboard.createCursorKeys();
  if (cursors.left.isDown) {
    this.gridEngine.move("player", "left");
  } else if (cursors.right.isDown) {
    this.gridEngine.move("player", "right");
  } else if (cursors.up.isDown) {
    this.gridEngine.move("player", "up");
  } else if (cursors.down.isDown) {
    this.gridEngine.move("player", "down");
  }
}
