{pkgs}: {
  deps = [
    pkgs.postgresql
    pkgs.bash
    pkgs.rustc
    pkgs.libiconv
    pkgs.cargo
  ];
}
