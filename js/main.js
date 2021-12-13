
const canvas = document.querySelector("#canvas");
const WIDTH = 960;
const HEIGHT = 960;
const TILE_SIZE = 32;


let ctx;
let gameMap;
let player;
let background;
let goal;
let paper;

let paperBlock;
let isBlock;
let winBlock;

let entities = new Array(10);
let blocks = new Array(10);

function init(width, height) {
	if (!canvas.getContext) {
			console.log("Unable to get canvas context");
	    return;
	}
	canvas.width = width;
	canvas.height = height;
	ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;

	gameMap = new TileMap(TILE_SIZE, WIDTH, HEIGHT);

	// load assets
	background = new Image();
	background.src = "assets/first-area.png";
	background.onload = function() {
		ctx.drawImage(background, 0, 0);
	}

	const paperSprite = new Image();
	paper = new Entity("paper", paperSprite, 480, 320);
	entities.push(paper);
	paperSprite.src = "assets/paper.png";
	paperSprite.onload = function() {
		ctx.drawImage(paperSprite, 480, 320);
	}

	const paperBlockSprite = new Image();
	paperBlock = new Entity("pblock", paperBlockSprite, 320, 320, true);
	entities.push(paperBlock); 
	blocks.push(paperBlock); 
	paperBlockSprite.src = "assets/block-paper.png";
	paperBlockSprite.onload = function() {
		ctx.drawImage(paperBlockSprite, 320, 320);
	}

	const isBlockSprite = new Image();
	isBlock = new Entity("iblock", isBlockSprite, 320, 352, true);
	entities.push(isBlock);
	blocks.push(isBlock); 
	isBlockSprite.src = "assets/block-is.png";
	isBlockSprite.onload = function() {
		ctx.drawImage(isBlockSprite, 320, 352);
	}

	const winBlockSprite = new Image();
	winBlock = new Entity("wblock", winBlockSprite, 320, 416, true);
	entities.push(winBlock);
	blocks.push(winBlock); 
	winBlockSprite.src = "assets/block-win.png";
	winBlockSprite.onload = function() {
		ctx.drawImage(winBlockSprite, 320, 416);
	}

	const mayaSprite = new Image();
	player = new Entity("maya", mayaSprite, 480, 480);
	entities.push(player);
	mayaSprite.src = "assets/front_maya.png";
	mayaSprite.onload = function() {
		ctx.drawImage(mayaSprite, 480, 480 - TILE_SIZE);
	}

}

function update() {
	draw();
	blockChecking();
	entities.forEach(entity => {
		entity.currTile.entityOccupying = entity;
		if (entity.goal) {
			goal = entity;
			if(player.x === goal.x && player.y === goal.y) {
				window.location.href = "search.html";
			}
		}
	});
}

function drawGrid() {
	gameMap.data.forEach(row => {
		row.forEach(column => {
			ctx.strokeStyle = 'green';
			ctx.strokeRect(column.centerX - TILE_SIZE/2, column.centerY - TILE_SIZE/2, 32, 32);
			ctx.strokeStyle = 'red';
			ctx.beginPath();
	 		ctx.arc(column.centerX, column.centerY, 2, 0, 2 * Math.PI);
	 		ctx.stroke();
		});
	});
}

function draw() {
	ctx.clearRect(0, 0, WIDTH, HEIGHT);
	ctx.drawImage(background, 0, 0);
	entities.forEach(entity => {
		if(entity.id === "maya") {
			ctx.drawImage(entity.sprite, entity.x, entity.y - TILE_SIZE);
		}
		else {
			ctx.drawImage(entity.sprite, entity.x, entity.y);
		}
		/* debug
		console.log(entity.x, entity.y);
		console.log(entity.x/TILE_SIZE, entity.y/TILE_SIZE);
		console.log(entity.id, entity.currTile);
		*/
	});
} function Tile(tileSize, posX, posY, collidable = false, entityOccupying = null) {
	this.topLeftX = posX * tileSize;
	this.topLeftY = posY * tileSize;
	this.centerX = posX * tileSize + tileSize/2; 
	this.centerY = posY * tileSize + tileSize/2; 
	this.rowIndex = posX;
	this.columnIndex = posY;
	this.collision = collidable;
	this.entityOccupying = entityOccupying;
}

function TileMap(tileSize, gameWidth, gameHeight) {
	this.tile = tileSize;
	this.width = gameWidth / tileSize;
	this.height = gameHeight / tileSize;
	this.data = new Array(this.height);
	for (let i = 0; i < this.height; i++) {
		if (i === 0) continue;
		this.data[i] = new Array(this.width);
		for (let j = 0; j < this.width; j++) {
				this.data[i][j] = new Tile(this.tile, j, i);
		}
	}
}

function Entity(id, sprite, posX, posY, pushable = false) {
	this.id = id;
	this.sprite = sprite;
	this.x = posX;
	this.y = posY;
	this.currTile = gameMap.data[this.y/TILE_SIZE][this.x/TILE_SIZE];
	this.push = pushable;
	this.goal = false;
}

function lerp(start, end, perc) {
	return (start + (end - start) * perc);
}

function move(entity, direction) {
	//TODO: Catch errors later for edge of map collisions
	let nextTile;
	switch (direction) {
		case "LEFT":
			nextTile = gameMap.data[entity.currTile.columnIndex][entity.currTile.rowIndex-1];
			break;
		case "RIGHT":
			nextTile = gameMap.data[entity.currTile.columnIndex][entity.currTile.rowIndex+1];
			break;
		case "UP":
			nextTile = gameMap.data[entity.currTile.columnIndex-1][entity.currTile.rowIndex];
			break;
		case "DOWN":
			nextTile = gameMap.data[entity.currTile.columnIndex+1][entity.currTile.rowIndex];
			break;
	}
	if (checkCollisions(nextTile) === "move") {
		entity.currTile.entityOccupying = null;
		entity.x = nextTile.topLeftX;
		entity.y = nextTile.topLeftY;
		entity.currTile = nextTile;
	}
	else if (checkCollisions(nextTile) === "push") {
		move(nextTile.entityOccupying, direction);
		move(entity.currTile.entityOccupying, direction);
	}
}

function checkCollisions(tile) {
	if (!tile.collision) {
		if (tile.entityOccupying != null && tile.entityOccupying.push) {
			return "push";
		} 
		else {
			return "move";
		}
	}
	else {
		return -1;
	}
}

function blockChecking() {
	if (paperBlock.currTile == gameMap.data[isBlock.currTile.columnIndex][isBlock.currTile.rowIndex-1] && winBlock.currTile == gameMap.data[isBlock.currTile.columnIndex][isBlock.currTile.rowIndex+1]) {
		console.log("success");
		paper.goal = true;
	}
	else if (paperBlock.currTile == gameMap.data[isBlock.currTile.columnIndex-1][isBlock.currTile.rowIndex] && winBlock.currTile == gameMap.data[isBlock.currTile.columnIndex+1][isBlock.currTile.rowIndex]) {
		console.log("success");
		paper.goal = true;
	}
}

/*
function particleCreator(posX, posY) {
}
*/

window.addEventListener("keydown", function (event) {
  if (event.defaultPrevented) {
    return; // Do nothing if the event was already processed
  }

  switch (event.key) {
    case "ArrowDown":
			move(player, "DOWN");
      break;
    case "ArrowUp":
			move(player, "UP");
      break;
    case "ArrowLeft":
			move(player, "LEFT");
      break;
    case "ArrowRight":
			move(player, "RIGHT");
      break;
    default:
      return; // Quit when this doesn't handle the key event.
  }
	update();
	// drawGrid(); // debug to make sure alignment is correct

  // Cancel the default action to avoid it being handled twice
  event.preventDefault();
}, true);

init(WIDTH, HEIGHT);
// paper.goal = true;
update();
