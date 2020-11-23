"""
SONATA Nodes access / writer.
"""
from voxcell.utils import deprecate


# pylint: disable=unused-argument
class NodePopulation(object):
    """ Read / write access to one-population on-group SONATA node collection. """
    def __init__(self, name, size):
        deprecate.fail("This class has been removed please use CellCollection.load() instead.")
