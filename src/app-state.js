// @ts-check

const default_magnification = 1;

/** @type {Tool} */
const default_tool = get_tool_by_id(TOOL_PENCIL);

const default_canvas_width = 683;
const default_canvas_height = 384;
let my_canvas_width = default_canvas_width;
let my_canvas_height = default_canvas_height;

let aliasing = true;
let transparency = false;
let monochrome = false;

let magnification = default_magnification;
let return_to_magnification = 4;

/** @type {PixelCanvas} */
const main_canvas = make_canvas();
main_canvas.classList.add("main-canvas");
/** @type {PixelContext} */
const main_ctx = main_canvas.ctx;

/** @type {(string | CanvasPattern)[]} */
let palette = default_palette;
/** @type {(string | CanvasPattern)[]} */
let polychrome_palette = palette;
/** @type {(string | CanvasPattern)[]} */
let monochrome_palette = make_monochrome_palette();

// This feature is not ready yet.
// It needs to let the user decide when to switch the palette or not, when saving/opening an image.
// (maybe there could be a palette undo button? feels weird. MS Paint would probably use a dialog.)
// And it needs to handle canvas farbling, where pixel values are slightly different from each other,
// and equivalize them, when saving to a file. And maybe at other times.
// There are a lot of places in this app where I have to handle canvas farbling. It's obnoxious.
let enable_palette_loading_from_indexed_images = false;

// The File System Access API doesn't provide a way to get the file type selected by the user,
// or to automatically append a file extension to the file name.
// I'm not sure it's worth it to be able to save over an existing file.
// I also like the downloads bar UI to be honest.
// So this might need to be optional, but right now I'm disabling it as it's not ready.
// There are cases where 0-byte files are created, which is either a serious problem,
// it's just from canceling saving when the file name has a problem, and it needs to be cleaned up.
// Also, while I've implemented most of the UI, it'd be nice to release this with recent files support.
let enable_fs_access_api = false;

// A bunch of these variables are declared with window.* for Cypress tests to access.
// TODO: consider exposing a little API specifically for Cypress tests

/** @type {BrushShape} */
window.default_brush_shape = "circle";
/** @type {number} */
window.default_brush_size = 4;
/** @type {number} */
window.default_eraser_size = 8;
/** @type {number} */
window.default_airbrush_size = 9;
/** @type {number} */
window.default_pencil_size = 1;
/** @type {number} */
window.default_stroke_size = 1; // applies to lines, curves, shape outlines

/** @type {BrushShape} */
window.brush_shape = default_brush_shape;
/** @type {number} */
window.brush_size = default_brush_size
/** @type {number} */
window.eraser_size = default_eraser_size;
/** @type {number} */
window.airbrush_size = default_airbrush_size;
/** @type {number} */
window.pencil_size = default_pencil_size;
/** @type {number} */
window.stroke_size = default_stroke_size; // applies to lines, curves, shape outlines
/** @type {boolean} */
let tool_transparent_mode = false;

/** @type {string | CanvasPattern | CanvasGradient} */
let stroke_color;
/** @type {string | CanvasPattern | CanvasGradient} */
let fill_color;
/** @type {ColorSelectionSlot} */
let stroke_color_k = "foreground";
/** @type {ColorSelectionSlot} */
let fill_color_k = "background";

/** @type {Tool} */
let selected_tool = default_tool;
/** @type {Tool[]} */
let selected_tools = [selected_tool];
/** @type {Tool[]} */
let return_to_tools = [selected_tool];

/** @type {{foreground: string | CanvasPattern, background: string | CanvasPattern, ternary: string | CanvasPattern}} */
window.selected_colors = { // declared with window.* for Cypress tests to access
	foreground: "",
	background: "",
	ternary: "",
};

/** @type {OnCanvasSelection} */
let selection; // singleton
/** @type {OnCanvasTextBox} */
let textbox; // singleton
/** @type {OnCanvasHelperLayer} */
let helper_layer; // instance used for the grid and tool previews (not a singleton)
/** @type {$Window} */
let $thumbnail_window;
/** @type {PixelCanvas} */
let thumbnail_canvas;
/** @type {boolean} */
let show_grid = false;
/** @type {boolean} */
let show_thumbnail = false;
/** @type {TextToolFontOptions} */
let text_tool_font = {
	family: '"Arial"', // should be an exact value detected by Font Detective
	size: 12,
	line_scale: 20 / 12,
	bold: false,
	italic: false,
	underline: false,
	vertical: false,
	color: "",
	background: "",
};

/** @type {HistoryNode} */
let root_history_node = make_history_node({ name: "App Not Loaded Properly - Please send a bug report." }); // will be replaced
/** @type {HistoryNode} */
let current_history_node = root_history_node;
/** @type {HistoryNode | null} */
let history_node_to_cancel_to = null;
/** @type {HistoryNode[]} */
let undos = [];
/** @type {HistoryNode[]} */
let redos = [];

/** @type {string | undefined} */
let file_name;
/** @type {string | undefined} */
let file_format;
/** For saving over opened file on Save. Can be different type for File System Access API vs Electron. 
 * @type {UserFileHandle} */
let system_file_handle;
/** @type {boolean} */
let saved = true;

/** works in canvas coordinates @type {{x: number, y: number} | undefined} */
let pointer;
/** works in canvas coordinates @type {{x: number, y: number} | undefined} */
let pointer_start;
/** works in canvas coordinates @type {{x: number, y: number} | undefined} */
let pointer_previous;

/** @type {boolean} */
let pointer_active = false;
/** @type {string | undefined} */
let pointer_type, pointer_buttons;
/** @type {boolean} */
let reverse;
/** @type {boolean} */
let ctrl;
/** @type {boolean} */
let shift;
/** @type {number | undefined} */
let button;
/** @type {boolean} */
let pointer_over_canvas = false;
/** @type {boolean} */
let update_helper_layer_on_pointermove_active = false;

/** works in client coordinates, NOT canvas coordinates
 * @type {{ x: number, y: number, pointerId: number, pointerType: string, isPrimary: boolean }[]} */
let pointers = [];
