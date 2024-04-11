/* Polyplot is copyright 2020 by Polyplot Berlin */


"use strict";

const queryString = window.location.search;
const bookslug = window.location.host.split(".", 1)[0].toLowerCase();
//const parentdomain = window.location.host.substr(window.location.host.search("\."));
const urlParams = new URLSearchParams(queryString);
const endString = "<p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>";
const navheight = 50;
const zoomLevels = [15, 18, 22, 25]
const mobile_ua_strings = /(?:Mobile|iPhone|iPad|Android|Windows Phone)/;
var mobile = mobile_ua_strings.test(navigator.userAgent);
// Sneaky new iPads pretend to be Macs
if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) mobile = true;
var book = false;
var v = {
	// Don't ask about the 48. Did I mention how I hate CSS and browsers?
	pp_html_ptrcounter: 0, 
	pp_html: "",
	pp_zoom: 1
};
var jumping = null;
var debugCounter = 0;	
var current_options = [];
var tags = {};
var last_if = false;
var scrolltimer = null;
const guru = false;
var audio = new Audio();

function makeID(length) {
	var result           = '';
	var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	while (result.length < length) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

const dbname = 'polyplot';
const dbversion = 1;
const dbstorename = 'polyplot';
var db;

function openDB(callback) {
	const openRequest = indexedDB.open(dbname, dbversion);
	openRequest.onupgradeneeded = function(e) {
		db = e.target.result;
		dbg('running onupgradeneeded');
		if (!db.objectStoreNames.contains(dbstorename)) {
			db.createObjectStore(dbstorename, {keyPath: 'key'});
			dbg ("Created store " + dbstorename);
		}
	};
	openRequest.onerror = function(e) {
		throw 'Error opening db ' + dbname;
	};
	openRequest.onsuccess = function(e) {
		dbg('DB ' + dbname + ' opened');
		db = e.target.result;	  
		const transaction = db.transaction(dbstorename, 'readonly');
		const objectStore = transaction.objectStore(dbstorename);
		const getReq = objectStore.getAll();
		getReq.onsuccess = function(event) {
			event.target.result.forEach(function(item) {
				v[item['key']] = item['value'];
			});
			callback();
		};
		getReq.onerror = function(event) {
			throw "Could not getAll() from " + dbname + "/" + dbstorename;
		};
	};
}

function saveVar(key) {
	dbg("saveVar: " + key + ":" + v[key]);
	const transaction = db.transaction(dbstorename, "readwrite");
	const objectStore = transaction.objectStore(dbstorename);				
	let record = { 'key': key, 'value': v[key] };
	let request = transaction.objectStore(dbstorename).put(record);
}

function saveVars() {
	dbg("saveVars");
	const transaction = db.transaction(dbstorename, "readwrite");
	const objectStore = transaction.objectStore(dbstorename);
	let request = objectStore.clear();			
	for (let key in v) {
		let record = { 'key': key, 'value': v[key] };
		let request = transaction.objectStore(dbstorename).put(record);
	}
}

$(window).on("load", function() {
	dbg("document ready");
	openDB(function() {
		startReader();
	});
});

function showVars() {
	dbg("showVars()");
	var keys = [];
	var content = "<table>\n";
	for (let vname in v) {
		if (! vname.startsWith("pp_") || guru) keys.push(vname);
	}
	keys.sort();
	for (let idx in keys) {
		let val = escapeHTML("" + v[keys[idx]])
		  .replace(/[']/g, "\'")
		  .replace(/\n/g, "\\n");
		content += "<tr><td class='name'>$" + keys[idx] 
		  + "</td><td class='value' title='" + val + "'>" + dbgstr(val)
		  + "</td></tr>";
	}
	content += "</table>";
	$('#vars').html(content);
}

function dbg(str) {
	console.log("book/reader.js: " + str);
}

function startReader() {
//	if (! v['pp_loader_done']) {
//		window.location.replace("/loader.html");
//		throw "pp_loader_done not set, running loader first.";
//	}
//	v['pp_loader_done'] = false;
//	saveVar('pp_loader_done');

	$('#booktext').css('font-size', zoomLevels[v['pp_zoom']] + 'px');
	if (v['pp_html']) $("#booktext").html(v['pp_html']);
	doBook();
	if (v['pp_dark']) { dark(); } else { light(); }
	if (v['pp_serif']) { serif(); } else { sans_serif(); }
	if (mobile) $('div.fontsize').css('visibility', 'visible');

	setTimeout(function() {
		scrollPosition(v['pp_scroll_ptr']);
		$('#booktext').scroll(function() {
			if (scrolltimer) window.clearTimeout(scrolltimer);
			scrolltimer = setTimeout(function() {
				v['pp_scroll_ptr'] = scrollPosition();
				saveVar('pp_scroll_ptr');
				dbg("stored new scroll position");
			}, 1000);
		});
	}, 1000);

}

function escapeCurlyBraces(str) {
	let ret = str;
	// Replace \{ and \} with unicode braces that don't trigger polyParse() 
	ret = ret.replace(/\\\{/g, ' ❴');
	ret = ret.replace(/\\\}/g, '❵ ');
	return ret;
}

function getHTTP(url) {
	var xmlhttp = new XMLHttpRequest ();
	xmlhttp.open('GET', url, false);
	xmlhttp.send();
	return xmlhttp.responseText;
}

function closeMenu() {
	$("input").prop("checked", false);
}

function library() {
	window.top.location.href = "https://polyplot.de";
}

function resetBook() {
	dbg("resetBook");
	closeMenu();
	if (v['pp_license']) {
		v = {
			pp_license : v['pp_license'],
			pp_k1 : v['pp_k1'],
			pp_k2 : v['pp_k2']
		}
	} else {
		v = {};
	}
	saveVars();
	window.location.reload(true);
}

function startOver() {
	dbg("startOver");
	closeMenu();
	v['pp_html'] = "";
	delete v['pp_book_ptr'];
	delete v['pp_html_ptr'];
	saveVars();
	window.location.replace("/");
}

function fontBigger(){
	if (v['pp_zoom'] < zoomLevels.length - 1) {
		doZoom(++v['pp_zoom']);
		$("#smaller").removeClass("disabled");
		saveVar('pp_zoom');
	}
	if (v['pp_zoom'] >= zoomLevels.length - 1) {
		$("#bigger").addClass("disabled");
	} 
}

function fontSmaller(){
	if (v['pp_zoom'] > 0) {
		doZoom(--v['pp_zoom']);
		$("#bigger").removeClass("disabled");
		saveVar('pp_zoom');
	}
	if (v['pp_zoom'] <= 0) {
		$("#smaller").addClass("disabled");
	}     	
}

function doZoom(zoomlevel) {
	var pos = scrollPosition();
	$('#booktext').css('font-size', zoomLevels[zoomlevel] + 'px');
	scrollPosition(pos);
}

function scrollPosition(pos=null) {
	if (pos === null) {
		var scroll = Math.min((document.getElementById('booktext').scrollTop + document.getElementById('booktext').clientHeight) / document.getElementById('booktext').scrollHeight, 1);
		dbg("scrollPosition read: " + scroll);
		return scroll;
	} else {
		var top = 0;
		if (isNaN(pos)) {
			try {
				top = document.getElementById(pos).offsetTop;
				dbg("Scrolled to id '" + pos + "' (scrollHeight: " + top + ")");
			} catch(e) {
				dbg("Could not locate id '" + pos + "' to scroll to"); 
				top = null;
			}
		} else {
			top = Math.round(( pos *  document.getElementById('booktext').scrollHeight ) - document.getElementById('booktext').clientHeight);
			top = Math.min(document.getElementById('booktext').scrollHeight - document.getElementById('booktext').clientHeight, top);
			top = Math.max(0, top);
			dbg("scrollPosition set to: " + pos + " (scrollHeight: " + top + ")");
		}
		if (top === null) {
			return false;
		} else {
			setTimeout(function() {
				document.getElementById('booktext').scrollTop = top;
			}, 50);
			return true;
		}
	}
}

function toggleDark() {
	$("input").prop("checked", false);
	if (!v['pp_dark']) {
		dark();
		v['pp_dark'] = true;
	} else {
		light();
		delete v['pp_dark'];
	}
	saveVars();
}

function dark() {
	$('#booktext').addClass('dark');
	$('#booktext').removeClass('light');
	$('#dark').html('Light Mode');
}

function light() {
	$('#booktext').addClass('light');
	$('#booktext').removeClass('dark');
	$('#dark').html('Dark Mode');
}

function toggleSerif() {
	closeMenu();
	if (!v['pp_serif']) {
		serif();
		v['pp_serif'] = true;
	} else {
		sans_serif();
		delete v['pp_serif'];
	}
	saveVars();
}

function serif() {
	$('#booktext').addClass('serif');
	$('#booktext').removeClass('sans');
	$('#serif').html('Font: Sans-Serif');
}

function sans_serif() {
	$('#booktext').addClass('sans');
	$('#booktext').removeClass('serif');
	$('#serif').html('Font: Serif');
}

function debugCount() {
	return ++debugCounter;
}

function dbgstr(str) {
	var ret = str;
	ret = ret.replace(/\n/g, "\\n");
	if (ret.length > 170) {
		ret = ret.substring(0, 80) + " ... [len " + str.length + "] ... " 
		  + ret.substr(-80);
	}
	return ret;
} 

function newHtmlPtr() {
	return ++v['pp_html_ptrcounter'];
}

async function doBook(h = null) {
	dbg("doBook");
 	if (!book) {
 		book = getHTTP('files/book.poly');
 		book = escapeCurlyBraces(book + endString);
 	}	
	let html_ptr = h;
	if (! h) html_ptr = v['pp_html_ptr'];
	if (v['pp_book_ptr'] == 'end') return;
	var new_html = polyParse(0, book.length);
	// Put back the escaped curly braces
	new_html = new_html.replace(/ ❴/g, '{');
	new_html = new_html.replace(/❵ /g, '}');
	// Every line that has something on it becomes its own <p>
	new_html = new_html.replace(/^(.*?\w+.*?)$/gm, '<p>$1</p>');
	new_html = new_html.replace(/↲/g, "\n");
	if (v['pp_html']) {
		dbg("Partly replacing HTML");
		var id = "#html_ptr_" + html_ptr;
		$(id).nextAll().remove();
		$(id).replaceWith(new_html);
	} else {
		dbg("Inserting new HTML");
		$("#booktext").html(new_html);
	}
	// The DOM unwraps some tags from their wrapping <p>'s, Leaving
	// those empty. A way to only wrap what needs to be wrapped would
	// be cleaner, but is beyond regex and needs a parsing step.
	$('p:empty').remove();
	v['pp_html'] = $("#booktext").html();
	saveVars();
}

function escapeHTML(str) {
	return str
	  .replace(/&/g, "&amp;")
	  .replace(/</g, "&lt;")
	  .replace(/>/g, "&gt;")
	  .replace(/"/g, "&quot;")
	  .replace(/'/g, "&#039;");
}

function idLocation(id) {
	if (id == 'end') return book.length;
	var re = new RegExp('\\{(?:options|anchor|chapter) ' + id + '[\\W$]');
	var x = book.search(re);
	if (x == -1) {
		dbg("ID not found: " + id);
		return false;
	}
	return x;
}

function polyParse(parseFrom, parseTo) {
	var thisNum = debugCount();
	var fnid = "polyParse[" + thisNum + "]";
	dbg(fnid + " gets: " + dbgstr(book.substring(parseFrom, parseTo)));
	if (jumping && parseFrom > 0) {
		dbg(fnid + " Not starting new parse, we're jumping"); 
		return;
	}
	var ret = "";
	var index = parseFrom;
	if (parseFrom == 0 && v['pp_book_ptr']) {
		index = idLocation(v['pp_book_ptr'])
		if (index === false) return "";
	}
	while(true){
		var tagstart = book.indexOf("{", index);
		if (tagstart == -1 || tagstart > parseTo) {
			ret += copied(book.substring(index, parseTo));
			break;
		} else {
			ret += copied(book.substring(index, tagstart));
			var tagend = tagstart + 1;
			var recursion = 1;
			while (true) {
				if (book[tagend] == "}" && book[tagend - 1] != "\\") {
					recursion--;
					if (recursion == 0) break;
				}
				if (book[tagend] == "{" && book[tagend - 1] != "\\") recursion++;
				tagend++;
				if (tagend > parseTo) {
					throw "Curly brace from line " + charToLine(tagstart) + 
					  " was never closed.";
				}
			}
			ret += tagParse(tagstart + 1, tagend);
			if (jumping) {
				if (parseFrom == 0) {
					if (jumping == "end") {
						jumping = null;
						dbg(fnid + " end reached, returning: " +
						  dbgstr(book.substring(ret)));
						return ret + endString;
					}
					index = idLocation(jumping);	
					jumping = null;
				} else {
					break;
				}
			} else {
				index = tagend + 1;
			}
		}
	}
	dbg(fnid + " returns: " + dbgstr(ret));
	return ret;
}

/*
splitUp takes the part of the book between `start` and `end` and splits a maximum of
'maxParts' parts separated by 'sep'. The result is an array of arrays, the inner 
arrays have three elements: start pos, end pos and the string in between.
*/
function splitUp(start, end, sep, maxParts) {
	var searchFrom = start;
	var separators = [];
	while (true) {
		let pos = book.substring(searchFrom, end).search(sep);
		if (pos == -1 || separators.length >= maxParts - 1) break;
		separators.push(pos + searchFrom);
		searchFrom = pos + searchFrom + 1;
	}
	var ret = [];
	var startPos = start;
	var endPos = end;
	while (true) {
		if (separators.length) {
			endPos = separators.shift();
			ret.push([startPos, endPos, book.substring(startPos, endPos).trim()]);
			startPos = endPos + 1;
		} else {
			ret.push([startPos, end, book.substring(startPos, end).trim()]);
			break;
		}
	}
	while (ret.length < maxParts) ret.push([0, 0, ""]);
	dbg("splitUp returns: " + ret + " (len: " + ret.length + ")");
	return ret;
}

function copied(str) {
	return (' ' + str).slice(1);
}

function doEval(script) {
	var modscr = '"use strict";' + script.replace(/\$(\w+)/g, "v['$1']");
	//dbg("eval: " + modscr);
	return eval(modscr);
}

function clickOption(optionvar, book_ptr, html_ptr) {
	if (v['pp_lock'] && html_ptr < v['pp_html_ptr']) {
		window.alert(v['pp_locktext']);
		return;
	}
	$("input").not("#pp_menu").prop("disabled", true);
	v['pp_book_ptr'] = book_ptr;
	v['pp_html_ptr'] = html_ptr;
	v[optionvar + "_selected"] = true;
	v[optionvar + "_ever"] = true;
	v[optionvar] = true;
	saveVars();
	doBook(html_ptr);
}

function goURL(url) {
	if (! navigator.onLine) {
		alert("You need to be online for this to work.");
	} else {
		window.location.href = url;
	}
}

function tagParse(tagStart, tagEnd) {
	var thisNum = debugCount();
	var fnid = "tagParse[" + thisNum + "]";
	dbg(fnid + " gets: " + dbgstr(book.substring(tagStart, tagEnd)));
	var parts = splitUp(tagStart, tagEnd, /[\s:]+/, 2);
	var tagname = parts[0][2];
	dbg ("tagname: " + tagname);
	if (tagname == "-") tagname = "comment";
	try {
		var func = eval("tag_" + tagname);
	}
	catch(err) {
		var func = tag_unknown;
		parts[1] = [tagStart, tagEnd, book.substring(tagStart, tagEnd)];
	}
	var tagText = parts[1][2];
	dbg ("tagText: " + tagText);
	try {
		if (tagText != "") {
			var ret = func(...parts[1]);
		} else {
			var ret = func();
		}
		if ($.type(ret) === 'string') {
			dbg(fnid + " exits, returns: " + dbgstr(ret));
			return ret;
		} else {
			dbg(fnid + " exits.");
			return "";
		}
	} catch (error) {
		throw new Error("Error " + error + " in tag " + tagname + 
						" on line " + charToLine(tagStart)
					   );
	}
}

function charToLine(charpos) {
	return (book.substring(0, charpos).match(/\n/g) || []).length + 1;
}





// Below are all the tags shipped with Polyplot. You can make your own
// tags by just creating a function like one of these in the book.js file.

function tag_anchor(tagTextStart, tagEnd, tagText) {
	// Nothing happens when anchor is encountered
}

function tag_audio(tagTextStart, tagEnd, tagText) {
	if (tagText == "stop") {
		audio.pause();
		return;
	}
	audio = new Audio(tagText);
	audio.play();
}

function tag_chapter(tagTextStart, tagEnd, tagText) {
	var parts = splitUp(tagTextStart, tagEnd, ":", 2);
	let chap_tag = parts[0][2];
	let chapter = parts[1][2];
	if (!v['pp_crumbs'] || !Array.isArray(v['pp_crumbs'])) {
		v['pp_crumbs'] = Array(chapter);
	} else {
		if (chapter != v['pp_crumbs'][v['pp_crumbs'].length - 1]) {
			v['pp_crumbs'].push(chapter);
		}
	}
	saveVar('pp_crumbs');
	return '\n<h2 id="' + chap_tag + '">' + chapter + '</h2>\n';
}

function tag_comment(tagTextStart, tagEnd, tagText) {
	// Nothing happens when comment is encountered
}

function tag_else(tagTextStart, tagEnd, tagText) {
	if (!last_if) {
		return polyParse(tagTextStart, tagEnd);
	}
}

function tag_end(tagTextStart, tagEnd, tagText) {
	dbg("endtag");
	jumping = 'end';
	v['pp_book_ptr'] = 'end';
}

function tag_if(tagTextStart, tagEnd, tagText) {
	var parts = splitUp(tagTextStart, tagEnd, ":", 2);
	dbg("'if' evaluating: " + parts[0][2]);
	last_if = doEval(parts[0][2]);
	if (last_if) {
		return polyParse(parts[1][0], parts[1][1]);
	}
}

function tag_inputfield(tagTextStart, tagEnd, tagText) {
	var parts = splitUp(tagTextStart, tagEnd, " ", 2);
	var varname = parts[0][2];
	var inputprops = parts[1][2];
	var tagID = makeID(8);
	return '<input ' + inputprops + ' id=' + tagID + '>' +
	       '<script type="text/javascript">$("#' + tagID + '").on("input", function() {' +
	       'v["' + varname + '"] = $("#' + tagID + '").val();' +
	       '});</script>';
}

function tag_jump(tagTextStart, tagEnd, tagText) {
	jumping = tagText;
	v[tagText] = true;
}

function tag_lock(tagTextStart, tagEnd, tagText) {
	v['pp_lock'] = true;
	v['pp_locktext'] = tagText;
	saveVars();
}

function tag_option(tagTextStart, tagEnd, tagText) {
	dbg ("tag_option: " + tagText)
	current_options.push( [tagTextStart, tagEnd] );
}

function tag_options(tagTextStart, tagEnd, tagText) {
	dbg ("tag_options");
	var options_id = splitUp(tagTextStart, tagEnd, ":", 2)[0][2];
	v['pp_html_ptr'] = newHtmlPtr();
	v['pp_book_ptr'] = options_id;
	dbg("setting book_ptr to: " + options_id);
	saveVars();
	
	var clickjump = "";
	current_options = [];
	polyParse(tagTextStart, tagEnd);
	var got_one = false;
	current_options.forEach(function(ptrs){
		var option_var = splitUp(ptrs[0], ptrs[1], ":", 2)[0][2];
		dbg("Option read: " + option_var);
		if (v[option_var + "_selected"]) got_one = true;
		if (v[option_var]) delete v[option_var];
	});
	var classes = "pp_options";
	if (!got_one) classes += " active";
	var ret = '<div class="' + classes + '" id="html_ptr_' + v['pp_html_ptr'] + '"' + clickjump + '>\n';
	current_options.forEach(function(ptrs) {
		var parts = splitUp(ptrs[0], ptrs[1], ":", 3);
		var option_var = parts[0][2];
		// var option_text = polyParse(parts[1][0], parts[1][1]);
		var option_text = parts[1][2];
		var option_cmds = parts[2][2];
		if (option_var == 'link') {
			var href = "javascript:goURL('" + option_cmds + "')";
		} else {
			var href = "javascript:clickOption('" + option_var + "', '" 
		 	  + options_id + "', " + v['pp_html_ptr'] + ")";
		}
		if (v[option_var + "_selected"]) {
			ret += '<div class="selected">' + option_text + '</div>\n';
			polyParse(parts[2][0], parts[2][1]);
			v[option_var] = true;
			delete v[option_var + "_selected"];
		} else if (v[option_var + "_ever"]) {
			ret += '<div class="before" onclick="' + href + '">' 
			  + option_text + '</div>\n';
		} else {
			ret += '<div onclick="' + href + '">' + option_text + '</div>\n';
		}
	});
	ret += '</div>';
	if (!got_one) {
		dbg ("Stopping render (got_one == " + got_one + ")");
		jumping = 'end';
	}
	return ret;
}

function tag_print(tagTextStart, tagEnd, tagText) {
	return doEval(tagText);
}

function tag_span(tagTextStart, tagEnd, tagText) {
	var parts = splitUp(tagTextStart, tagEnd, ":", 2);
	var cssclass = parts[0][2];
	var span_open  = '<span class="' + cssclass +'">';
	var span_close = "</span>";
	var ret = '<span class="' + cssclass +'">' + polyParse(parts[1][0], parts[1][1]) + '</span>';
	// var ret = '<span class="' + cssclass +'">' + parts[1][2] + '</span>';
	// If the 'white-space' css property for our span includes 'pre', we
	// replace the newlines with a special token, to be put back in later
	// processing.
	var el = $(span_open + span_close);
	$("#booktext").append(el);
	try {
		//if ($("." + cssclass).css('white-space').includes("pre")) {
			ret = ret.replace(/\n/g, "↲")
		//}
	} catch {}
 	$("#booktext").remove(el);
	return ret
}

function tag_unknown(tagTextStart, tagEnd, tagText) {
	dbg ("about to evaluate: " + tagText);
	doEval(tagText);
}

function tag_unlock(tagTextStart, tagEnd, tagText) {
	v['pp_lock'] = false;
	saveVar('pp_lock');
}
