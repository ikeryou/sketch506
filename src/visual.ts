import { CatmullRomCurve3, CircleGeometry, Color, Mesh, MeshBasicMaterial, Object3D, Raycaster, TubeGeometry, Vector2, Vector3 } from "three"
import { Canvas } from "../webgl/canvas"
import { MyObject3D } from "../webgl/myObject3D"
import { MouseMgr } from "../core/mouseMgr"
import { Func } from "../core/func"
import { Val } from "../libs/val"
import { Util } from "../libs/util"
import { Tween } from "../core/tween"

export class Visual extends Canvas {

  private _con: Object3D
  private _ray: Raycaster = new Raycaster()
  private _items: Array<ToggleMushi> = []
  private _hoverTestMesh: Array<Mesh> = []

  constructor(opt:any) {
    super(opt)

    this._con = new Object3D()
    this.mainScene.add(this._con)

    const num = 25
    for(let i = 0; i < num; i++) {
      const s = Util.random(0.25, 1.75)
      const size = new Vector2(100 * s, 18 * s)
      const item = new ToggleMushi(
        i,
        new Vector3(Util.range(Func.sw() * 0.5), Util.range(Func.sh() * 0.35), 0), 
        size
      )
      this._con.add(item)
      this._items.push(item)
      this._hoverTestMesh.push(item.line)
    }

    this._setClickEvent(this.el, () => {
      this._eClick()
    })

    this._resize()
  }

  private _eClick():void {
    this._items.forEach((val) => {
      if(val.isHover) val.setToggle(!val.isActive)
    })
  }

  _update():void {
    super._update()

    

    // マウス判定 
    this._items.forEach((val) => {
      val.isHover = false
    })
    
    const mousePos = new Vector2(MouseMgr.instance.normal.x, MouseMgr.instance.normal.y * -1)
    this._ray.setFromCamera(mousePos, this.cameraOrth)
    const intersects = this._ray.intersectObjects(this._hoverTestMesh)
    const isHover: boolean = intersects.length > 0
    if(isHover) {
      ((intersects[0].object as any).myCurrent as ToggleMushi).isHover = true
    }

    if(isHover) {
      document.body.style.cursor = 'pointer'
    } else {
      document.body.style.cursor = 'default'
    }
    
    if(this.isNowRenderFrame()) {
      this._render()
    }
  }

  _render():void {
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.render(this.mainScene, this.cameraOrth)
  }

  isNowRenderFrame():boolean {
    return true
  }

  _resize():void {
    super._resize()

    const w = Func.sw()
    const h = Func.sh()

    this.renderSize.width = w
    this.renderSize.height = h

    this._updateOrthCamera(this.cameraOrth, w, h)

    let pixelRatio:number = window.devicePixelRatio || 1
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(w, h)
  }

  
}



export class ToggleMushi extends MyObject3D {

  private _lineId: number = 0

  private _line: Mesh;
  public get line():Mesh { return this._line }

  private _lineShadow: Mesh;

  private _edge:Array<Mesh> = [];
  private _edgeShadow:Array<Mesh> = [];
  private _dot: Mesh;
  private _dotPosRate: Val = new Val(0);
  private _btnColor: Color = new Color(0xffffff)
  private _defaultBgColor: Color = new Color(0xcccccc)
  private _activeBgColor: Color = new Color(0x76d672)
  private _lineMat: MeshBasicMaterial
  private _moveRate: Val = new Val(0)
  private _basePos: Vector3 = new Vector3()
  private _size: number = 18
  private _width: number = 100
  private _t: number = Util.random(0.5, 1)
  private _it: number = Util.random(0, 0.5)

  private _isActive: boolean = false
  public set isActive(v:boolean) { this._isActive = v }
  public get isActive():boolean { return this._isActive }

  private _isHover: boolean = false
  public set isHover(v:boolean) { this._isHover = v }
  public get isHover():boolean { return this._isHover }


  constructor(id:number,pos:Vector3, size: Vector2) {
    super()

    this._lineId = id

    if(Util.hit(3)) {
      this._isActive = true
      this._dotPosRate.val = 1
    }

    this._basePos.x = pos.x
    this._basePos.y = pos.y

    this._size = size.y
    this._width = size.x

    this._lineMat = new MeshBasicMaterial({
      depthTest: false,
      color: this._activeBgColor,
      transparent: true,
    })

    const baseOrder = this._lineId * 2

    for(let i = 0; i < 2; i++) {
      const edgeShadow = new Mesh(
        new CircleGeometry(0.5, 64),
        new MeshBasicMaterial({
          depthTest: false,
          color: 0x000000,
          transparent: true,
          opacity: 0.25,
        })
      )
      this.add(edgeShadow)
      this._edgeShadow.push(edgeShadow)
      edgeShadow.renderOrder = baseOrder - 1

      const edge = new Mesh(
        new CircleGeometry(0.5, 64),
        this._lineMat
      );
      this.add(edge);
      this._edge.push(edge);
      edge.renderOrder = baseOrder + 1;
    }

    this._dot = new Mesh(
      new CircleGeometry(0.5, 64),
      new MeshBasicMaterial({
        depthTest: false,
        transparent: true,
        color: this._btnColor,
      })
    );
    this.add(this._dot);
    this._dot.renderOrder = baseOrder + 1;

    this._lineShadow = new Mesh(
      this._makeLineGeo(),
      new MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        color: 0x000000,
        opacity: 0.25,
      })
    );
    this.add(this._lineShadow);
    this._lineShadow.renderOrder = baseOrder;

    this._line = new Mesh(
      this._makeLineGeo(),
      this._lineMat
    );
    this.add(this._line);
    this._line.renderOrder = baseOrder;

    

    (this._line as any).myCurrent = this

    this._move(0)

    this._resize()
  } 


  private _move(d: number = 0): void {
    const t = this._t
    const ease = Tween.ExpoEaseInOut

    Tween.a(this._moveRate, {
      val:[0, 1]
    }, t, d, ease)

    if(this._basePos.x < Func.sw() * -0.5 - this._width) {
      this._basePos.x = Func.sw() * 0.5 + this._width
    } else if(this._basePos.x > Func.sw() * 0.5 + this._width) {
      this._basePos.x = Func.sw() * -0.5 - this._width
    }
    

    const x = this._basePos.x - this._width * (this._isActive ? -1 : 1)

    

    Tween.a(this._basePos, {
      x: x,
    }, t, d, ease, null, null, () => {
      this._move(this._it)
    })

    
  }


  public setToggle(v:boolean): void {
    this._isActive = v
    Tween.a(this._dotPosRate, {
      val: v ? 1 : 0
    }, 0.75, 0, Tween.ExpoEaseOut)
  }


  // ---------------------------------
  // 更新
  // ---------------------------------
  protected _update(): void {
    super._update()

    const col = this._defaultBgColor.clone().lerp(this._activeBgColor.clone(), this._dotPosRate.val)
    // col.offsetHSL(0, 0, this._isHover ? 0.1 : 0)

    this._lineMat.color = col;    

    this._line.geometry.dispose()
    this._line.geometry = this._makeLineGeo()
    this._lineShadow.geometry.dispose()
    this._lineShadow.geometry = this._line.geometry

    this._lineShadow.position.y = this._line.position.y - 2
  }

  // ---------------------------------
  // リサイズ
  // ---------------------------------
  protected _resize(): void {
    super._resize()
  }

  // ---------------------------------
  private _makeLineGeo(): TubeGeometry {
    const arr: Array<Vector3> = [];

    const width = Util.map(Math.sin(Util.radian(this._moveRate.val * 180)), this._width, this._width * 0.75, 0, 1)

    arr.push(new Vector3(this._basePos.x - width * 0.5, this._basePos.y, 0))
    arr.push(new Vector3(this._basePos.x, this._basePos.y - Util.map(Math.sin(Util.radian(this._moveRate.val * 180)), 0, this._width * -0.25, 0, 1), 0))
    arr.push(new Vector3(this._basePos.x + width * 0.5, this._basePos.y, 0))

    const width2 = this._size;

    const edgeSize = width2 * 1.75;
    this._edge[0].scale.set(edgeSize, edgeSize, 1);
    this._edge[1].scale.set(edgeSize, edgeSize, 1);

    this._edge[0].position.x = arr[0].x;
    this._edge[0].position.y = arr[0].y;

    this._edge[1].position.x = arr[arr.length - 1].x;
    this._edge[1].position.y = arr[arr.length - 1].y;

    const btnSize = width2 * 1.5;
    this._dot.scale.set(btnSize, btnSize, 1);

    const sampleClosedSpline = new CatmullRomCurve3(arr, false);
    const tube = new TubeGeometry(sampleClosedSpline, 64, width2, 3, false);

    const dotPos = sampleClosedSpline.getPointAt(this._dotPosRate.val);
    this._dot.position.copy(dotPos);

    this._edgeShadow[0].scale.set(edgeSize, edgeSize, 1)
    this._edgeShadow[1].scale.set(edgeSize, edgeSize, 1)
    
    this._edgeShadow[0].position.copy(this._edge[0].position)
    this._edgeShadow[1].position.copy(this._edge[1].position)

    this._edgeShadow[0].position.y -= 2
    this._edgeShadow[1].position.y -= 2

    return tube;
  }
}