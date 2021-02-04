window.onload = init;

const localModels  = 'models/';
const loader = new THREE.GLTFLoader();
const patterns = ['kanji', 'letterF', 'letterB', 'letterC'];
let scene, plateau, dish, indoor, dishOnPlateau, models;
let markerArray = []; let dishes = [];

class Model{
    constructor(metadata){
        this.path = localModels+metadata.name+'/scene.gltf';
        this.subset = metadata.subset;
        this.name = metadata.name;
        this.scale = metadata.scale;
		this.ovenPos = metadata.ovenPosition;
		this.markerPos = metadata.markerPosition;
    }
}

class Oven{
	constructor(markerRoot){
		loader.load(localModels+'/oven__microwave/scene.gltf', (gltf) => {
			//let mixer = new THREE.AnimationMixer( gltf.scene );
			//let action = mixer.clipAction( gltf.animations[0] );
			this.mesh = gltf.scene;
			markerRoot.add( this.mesh );
			gltf.scene.traverse( (child) => {
				if(child.name === "inner_oven_6"){ 
					child.add(dishOnPlateau); 
				}
			});
		});
	}
}

class Plateau{
    constructor(){
        this.mesh = new THREE.Object3D();
	    this.mesh.name = "plateau";

        const diskGeom = new THREE.CylinderGeometry( 0.8, 0.8, 0.05, 64 );
        let diskMat = new THREE.MeshPhongMaterial();
        diskMat.color.setRGB(0.25, 0.25, 0.25);
        diskMat.opacity = .5;
        diskMat.transparent = true;

        this.disk = new THREE.Mesh( diskGeom, diskMat );
        this.disk.name = "disk";
        this.disk.rotateY(Math.PI/2);
        this.disk.translateOnAxis(new THREE.Vector3(0, 1, 0), -0.5);
        this.mesh.add(this.disk);

        const geomPiv = new THREE.BoxGeometry( .1, .1, .1 );
        const matPiv = new THREE.MeshBasicMaterial( {color: 0x000000} );
        this.pivot = new THREE.Mesh( geomPiv, matPiv );
        this.pivot.translateOnAxis(new THREE.Vector3(0, 1, 0), -0.6);
        this.mesh.add( this.pivot );
    }
}

class Dish{
    constructor(idx, markerRoot=null){
        this.mesh = new THREE.Object3D();
	    this.mesh.name = models[idx].name;
        loader.load(models[idx].path, (gltf) => {
            let toAdd;
            if(models[idx].subset.length > 0){
                gltf.scene.traverse( (child) => {
                    if(child.name === models[idx].subset){
                        toAdd = child;
                    }
                });
            }else{ toAdd = gltf.scene; }
            toAdd.scale.x = models[idx].scale;
            toAdd.scale.y = models[idx].scale;
			toAdd.scale.z = models[idx].scale;
			if(markerRoot != null){
				this.mesh.add(toAdd);
				markerRoot.add(this.mesh);
			}else{
				toAdd.position.x = models[idx].ovenPos[0];
				toAdd.position.y = models[idx].ovenPos[1];
				toAdd.position.z = models[idx].ovenPos[2];
				this.mesh.add(toAdd); 
			}
        });
    }
}

class Scene{
	constructor(){
		this.scene = new THREE.Scene();
		// Light
		let ambientLight = new THREE.AmbientLight( 0xcccccc, 1.0 );
		this.scene.add( ambientLight );	
		// Camera
		this.camera = new THREE.Camera();
		this.scene.add(this.camera);

		this.renderer = new THREE.WebGLRenderer({
			antialias : true,
			alpha: true
		});
		this.renderer.setClearColor(new THREE.Color('white'), 0)
		this.renderer.setSize( 640, 480 );
		this.renderer.domElement.style.position = 'absolute'
		this.renderer.domElement.style.top = '0px'
		this.renderer.domElement.style.left = '0px'
		document.body.appendChild( this.renderer.domElement );

		this.clock = new THREE.Clock();
		this.deltaTime = 0;
		this.totalTime = 0;
		
		// setup arToolkitSource
		this.arToolkitSource = new THREEx.ArToolkitSource({
			sourceType : 'webcam',
		});

		this.arToolkitSource.init(function onReady(){
			this.onResize()
		}.bind(this));
		
		// handle resize event
		window.addEventListener('resize', function(){
			this.onResize();
		}.bind(this));

		this.setupARToolkitContext();
		this.setupMarkerRoots();
		indoor = new THREE.Group();
	}

	onResize(){
		this.arToolkitSource.onResize()	
		this.arToolkitSource.copySizeTo(this.renderer.domElement)	
		if ( this.arToolkitContext.arController !== null )
		{
			this.arToolkitSource.copySizeTo(this.arToolkitContext.arController.canvas)	
		}	
	}
	
	setupARToolkitContext(){
		// create atToolkitContext
		this.arToolkitContext = new THREEx.ArToolkitContext({
			cameraParametersUrl: 'assets/camera_para-1m.dat',
			detectionMode: 'mono'
		});
		
		// copy projection matrix to camera when initialization complete
		this.arToolkitContext.init( function onCompleted(){
			this.camera.projectionMatrix.copy( this.arToolkitContext.getProjectionMatrix() );
		}.bind(this));
	}
	
	setupMarkerRoots(){
		for (let i = 0; i < Math.min(models.length, patterns.length)+1; i++){
			let markerRoot = new THREE.Group();
			this.scene.add(markerRoot);
			let markerControls = new THREEx.ArMarkerControls(this.arToolkitContext, markerRoot, {
				type : 'pattern', patternUrl : "assets/" + patterns[i] + ".patt",
			});
			if(i == 0){ // Bind the first marker (e.g. kanji) and the oven
				let oven = new Oven(markerRoot);
			}else{ // Bind the other markers (e.g. letters) and the dishes
				let dishM = new Dish(i-1, markerRoot);
				markerArray.push(markerRoot);
			}
		}
	}

	update(){
		// Update artoolkit on every frame
		if ( this.arToolkitSource.ready !== false )
			this.arToolkitContext.update( this.arToolkitSource.domElement );
		if(indoor != undefined)
			indoor.rotation.y += Math.PI/192;
		
		for (let i = 0; i < markerArray.length; i++){
			if (! markerArray[i].visible ){
				indoor.children.pop(1);
				indoor.add(dishes[i].mesh);
				break;
			}
		}
	}
	
	render(){ this.renderer.render( this.scene, this.camera ); }
	
	changeTime(){
		this.deltaTime = this.clock.getDelta();
		this.totalTime += this.deltaTime;
	}
}


function init(){
	models = [];
    fetch('assets/models.json').then(r => r.json())
    .then(r => {
		// Get the dishes model metadata
		r.models.forEach(metadata => { models.push(new Model(metadata)); })
		// Initialize the Three.js and AR tools/objects
		scene = new Scene();
        createPlateau();
        animate();
    })
}

function createPlateau(){
    plateau = new Plateau();
    indoor.add(plateau.mesh);
    createDish(0);
    dishOnPlateau = new THREE.Group();
    dishOnPlateau.position.x = 0.5;
    dishOnPlateau.add( indoor );
}

function createDish(idx){
	for(let i=0; i < models.length; i++ ){
		dish = new Dish(i);
		dishes.push(dish)
		if(i == idx){
			indoor.add(dish.mesh);
		}
		console.log(indoor);
	}
}

function animate(){
	requestAnimationFrame(animate);
	scene.changeTime();
	scene.update();
	scene.render();
}
