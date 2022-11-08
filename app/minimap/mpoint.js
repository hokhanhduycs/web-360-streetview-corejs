import { Vector3 } from "three";
import MiniMapItem from "./mitem";
import MRenderConfig from "./mrenderconfig";
export default class MiniMapPoint extends MiniMapItem {
    guid = "";
    pos = new Vector3();
    pos2d = { x: 0, y: 0 };
    profile = '';
    links = [];
    status = false;
    colorid = 0;
    constructor(data) {
        super(data?.name);
        Object.assign(this, data);
        this.children = [];
    }
    isInRect(rect) {
        return (this.pos2d.x - rect.x) * (this.pos2d.x - rect.x - rect.width) < 0 && (this.pos2d.y - rect.y) * (this.pos2d.y - rect.y - rect.height) < 0;
    }
    render(ctx) {
        if (!this.visible)
            return;
        if ((MRenderConfig.config.link == 'showlink' || (MRenderConfig.config.link == 'showlinkonlyselect' && this.select)) && !this.lock && this.visible) {
            ctx.strokeStyle = MRenderConfig.config.linkColor;
            ctx.lineWidth = MRenderConfig.config.borderRadius;
            for (const l of this.links) {
                ctx.beginPath();
                ctx.moveTo(this.pos2d.x, this.pos2d.y);
                ctx.lineTo(l.pos2d.x, l.pos2d.y);
                ctx.stroke();
                ctx.closePath();
            }
        }
        if (this.lock) {
            ctx.fillStyle = MRenderConfig.config.colorDisable;
        }
        else if (!this.status) {
            ctx.fillStyle = MRenderConfig.config.colorError;
        }
        else if (this.status) {
            ctx.fillStyle = MRenderConfig.config.color;
        }
        if (MRenderConfig.config.isCustomColor) {
            ctx.fillStyle = MRenderConfig.config.customColor[this.colorid];
        }
        ctx.beginPath();
        ctx.arc(this.pos2d.x, this.pos2d.y, MRenderConfig.config.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = MRenderConfig.config.color;
        if (MRenderConfig.config.border == 'all' || (MRenderConfig.config.border == 'select' && this.select)) {
            ctx.lineWidth = MRenderConfig.config.borderRadius;
            ctx.strokeStyle = MRenderConfig.config.borderColor;
            ctx.stroke();
        }
        ctx.closePath();
    }
}
//# sourceMappingURL=mpoint.js.map