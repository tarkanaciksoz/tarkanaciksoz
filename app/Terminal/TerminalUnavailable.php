<?php

namespace App\Terminal;

use RuntimeException;

/** The model could not be reached. The message is shown to the visitor as a shell error line. */
final class TerminalUnavailable extends RuntimeException {}
