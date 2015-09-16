'''simple integration of the brain builder viewer with ipython notebooks'''

import os
import copy
from os.path import join as joinp
from brainbuilder.utils import viewer
from brainbuilder.utils import genbrain as gb
from IPython.display import HTML, display


class NotebookViewer(object):
    '''encapsulates the integration of the webgl in an ipython notebook'''

    def __init__(self):
        ''' NotebookViewer '''
        # The location where the output will be stored
        # under the viewer directory
        self.directory = 'out'
        self.output_directory = joinp('..', 'viewer', self.directory)

        if not os.path.isdir(self.output_directory):
            os.makedirs(self.output_directory)

    def show(self, filename):
        '''display the given local file'''
        url = '../../static/index.html#' + joinp(self.directory, filename)
        html = ('<iframe src="{url}"'
                ' scrolling="no" width="700" height="350"></iframe>\n'
                '<br>'
                '<a href="{url}" target="_blank">fullscreen</a>').format(url=url)

        display(HTML(html))

    def show_metaio(self, name, base_mhd, raw):
        '''save a MetaIO file locally and display it'''
        filename_raw = name + '.raw'
        filename_mhd = name + '.mhd'
        mhd = copy.copy(base_mhd)
        mhd['ElementDataFile'] = filename_raw
        gb.save_meta_io(joinp(self.output_directory, filename_mhd), mhd,
                        joinp(self.output_directory, filename_raw), raw)
        self.show(filename_mhd)

    def show_points(self, name, cells):
        '''save a bunch of positions locally and display them'''
        fullpath = joinp(self.output_directory, name + '.pts')
        colors = [[0.9, 0.9, 1]] * len(cells.positions)
        viewer.serialize_points(fullpath, cells.positions, colors)
        self.show(name + '.pts')

    def show_property(self, name, cells):
        '''save a bunch of positions with properties locally and display them'''
        fullpath = joinp(self.output_directory, name + '.pts')
        viewer.export_points(fullpath, cells, name)
        self.show(name + '.pts')

    def show_placement(self, name, cells, coloring=None):
        '''save a bunch of morphologies placement and display them

        Args:
            coloring: the name of the property to use as color (default: morphology)
        '''
        fullpath = joinp(self.output_directory, name + '.placement')
        coloring = coloring if coloring is not None else 'morphology'
        viewer.export_positions_vectors(fullpath, cells, coloring)
        morph_fullpath = joinp(self.output_directory, name + '.txt')
        viewer.export_strings(morph_fullpath, cells.properties.morphology)
        self.show(name + '.placement')