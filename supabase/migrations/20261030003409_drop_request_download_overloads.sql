-- Every deployment now calls the five-argument request_download (#14), so the wrappers kept for
-- older previews on the shared dev database go: the three-argument one (#9) and the four-argument
-- one (#14). The three-argument one calls the four-argument one, so it goes first.
drop function public.request_download(text, text, text);
drop function public.request_download(text, text, boolean, text);
