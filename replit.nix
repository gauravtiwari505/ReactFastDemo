{pkgs}: {
  deps = [
    pkgs.glibcLocales
    pkgs.freetype
    pkgs.postgresql
    pkgs.bash
    pkgs.rustc
    pkgs.libiconv
    pkgs.cargo
  ];
}
