# autocomplete-js-import
Autocomplete+ provider for JS import statements

This allows the completion of any files relative to the current directory.
Additionally, there are settings to enable autocompletion of dependent packages found in the current
project's root package.json file.

![import local files screenshot](https://raw.githubusercontent.com/DanielGarcia-Carrillo/autocomplete-js-import/master/misc/autocomplete-screenshot.png)

New Fuzzy matching (disabled by default)

![](https://raw.githubusercontent.com/DanielGarcia-Carrillo/autocomplete-js-import/master/misc/fuzzy-matching.gif)

# TODO / Known Issues
* Changing settings doesn't do anything until atom restart
* Fuzzy pattern matching doesn't work with files added/removed after project is added
* Attempting to fuzzy search with slashes or periods inserts suggestion incorrectly

# Wontfix issues
* Editing package.json dependencies doesn't reflect in suggestions until restart
  * Requires me to watch files which could be a heavy operation for large package.json
