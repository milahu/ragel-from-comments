{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {

buildInputs = with pkgs; [
gnumake # to build tree-sitter-c
];

}
