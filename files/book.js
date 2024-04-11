// This is where you can put your own javascript for use in your book.

function ordinal(n) {
    var s = ["th", "st", "nd", "rd"];
    var v = n % 100;
    return n + "<sup>" + (s[(v-20)%10] || s[v] || s[0]) + "</sup>";
}

function tag_tt(tagTextStart=null, tagEnd=null) {
	var tagtext = "Taktuq";
	if (tagTextStart) tagtext = polyParse(tagTextStart, tagEnd);
	return "<span class='taktuq'>" + tagtext + "</span>";
}