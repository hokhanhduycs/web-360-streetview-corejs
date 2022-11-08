import MiniMapItem from "./mitem";
import MiniMapPoint from "./mpoint";
export default class MiniMapLayer extends MiniMapItem {
    constructor(data) {
        super(data?.name);
        Object.assign(this, data);
        this.children = [];
        if (data?.children)
            for (const item of data.children) {
                this.children.push(new MiniMapPoint(item));
            }
    }
    render(ctx) {
        if (!this.visible)
            return;
        for (const item of this.children) {
            if (this.lock)
                item.lock = this.lock;
            item.render(ctx);
        }
    }
}
//# sourceMappingURL=mlayer.js.map