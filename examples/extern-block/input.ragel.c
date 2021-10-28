extern "ragel" {

  // set machine name
  machine some_machine;

  /*
    comment block
  */

}

// "write error;" evaluates to "some_machine_error"
if (state->rc == RAGEL(write error;)) {
  printf("error\n");
}

// "write first_final;" evaluates to "some_machine_first_final"
if (state->rc == RAGEL(write first_final;)) {
  printf("first final\n");
}
