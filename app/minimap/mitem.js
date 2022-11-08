export default class MiniMapItem {
    name = '';
    fullname = '';
    lock = false;
    select = false;
    visible = true;
    children = [];
    constructor(name) {
        this.name = name ? name : 'default';
        this.fullname = this.name;
    }
    traverse(callback, forceHidden) {
        for (const item of this.children) {
            if ((item.lock || !item.visible) && !forceHidden) {
                continue;
            }
            callback(item);
            item.traverse(callback, forceHidden);
        }
    }
    render(ctx) {
        if (!this.visible)
            return;
    }
}
//# sourceMappingURL=mitem.js.map