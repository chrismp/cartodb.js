cdb.geo.ui.Widget.Histogram.Chart = cdb.core.View.extend({

  defaults: {
    duration: 750,
    handleWidth: 6,
    handleHeight: 23,
    handleRadius: 3,
    transitionType: 'elastic'
  },

  initialize: function() {

    _.bindAll(this, '_selectBars', '_adjustBrushHandles', '_onBrushMove', '_onBrushStart', '_onMouseMove', '_onMouseEnter', '_onMouseOut');

    this._setupModel();
    this._setupDimensions();
  },

  render: function() {
    this._generateChart();

    this._generateHorizontalLines();
    this._generateVerticalLines();

    this._generateBars();

    this._generateHandles();

    this._setupBrush();
    this._generateXAxis();

    return this;
  },

  _removeBars: function() {
    this.chart.selectAll('.Bar').remove();
  },

  _removeBrush: function() {
    this.brush
    .clear()
    .event(this.chart.select('.Brush'));
    this.chart.classed('is-selectable', false);
  },

  reset: function(data) {
    this.loadData(data);
    this._removeBrush();
    this.model.set({ a: 0, b: this.model.get('data').length });
  },

  _generateVerticalLines: function() {
    var range = d3.range(0, this.chartWidth + this.chartWidth / 4, this.chartWidth / 4);

    var lines = this.chart.select('.Lines');

    lines.append('g')
    .attr('class', 'y')
    .selectAll('.x')
    .data(range.slice(1, range.length - 1))
    .enter().append('svg:line')
    .attr('y1', 0)
    .attr('x1', function(d) { return d && d.freq; })
    .attr('y2', this.chartHeight)
    .attr('x2', function(d) { return d && d.freq; });
  },

  _generateHorizontalLines: function() {
    var range = d3.range(0, this.chartHeight + this.chartHeight / 2, this.chartHeight / 2);

    var lines = this.chart.append('g')
    .attr('class', 'Lines');

    lines.append('g')
    .attr('class', 'y')
    .selectAll('.y')
    .data(range)
    .enter().append('svg:line')
    .attr('class', 'y')
    .attr('x1', 0)
    .attr('y1', function(d) { return d && d.freq; })
    .attr('x2', this.chartWidth)
    .attr('y2', function(d) { return d && d.freq; });

    this.bottomLine = lines
    .append('line')
    .attr('class', 'l_bottom')
    .attr('x1', 0)
    .attr('y1', this.chartHeight)
    .attr('x2', this.chartWidth - 1)
    .attr('y2', this.chartHeight);
  },

  _setupModel: function() {
    this.model = new cdb.core.Model({ 
      data: this.options.data,
      pos: { x: 0, y: 0 }
    });

    this.model.bind('change:pos', this._onChangePos, this);
    this.model.bind('change:a change:b', this._onChangeRange, this);
    this.model.bind('change:data', this._onChangeData, this);
    this.model.bind('change:dragging', this._onChangeDragging, this);
  },

  _setupDimensions: function() {
    var data = this.model.get('data');

    this.margin = { top: 0, right: 0, bottom: 20, left: 0 };

    this.canvasWidth  = this.options.width;
    this.canvasHeight = this.options.height;

    this.chartWidth  = this.canvasWidth - this.margin.left - this.margin.right;
    this.chartHeight = this.options.height;

    this._setupScales();
  },

  _setupScales: function() {
    var data = this.model.get('data');
    this.xScale = d3.scale.linear().domain([0, 100]).range([0, this.chartWidth]);
    this.yScale = d3.scale.linear().domain([0, d3.max(data, function(d) { return d && d.freq; } )]).range([this.chartHeight, 0]);
    this.zScale = d3.scale.ordinal().domain(d3.range(data.length)).rangeRoundBands([0, this.chartWidth]);
  },

  _calcBarWidth: function() {
    this.barWidth = this.chartWidth / this.model.get('data').length;
  },

  _generateChart: function() {
    this.chart = d3.select(this.options.el[0])
    .selectAll('.Canvas')
    .append('g')
    .attr('class', 'Chart')
    .attr('opacity', 0)
    .attr('transform', 'translate(0, ' + this.options.y + ')');

    this.chart.classed(this.options.className || '', true);
  },

  hide: function() {
    this.chart
    .transition()
    .duration(150)
    .attr('opacity', 0)
    .style('display', 'none')
    .attr('transform', 'translate(0, ' + (this.options.y - 10) + ')');
  },

  show: function() {
    this.chart
    .attr('transform', 'translate(0, ' + (this.options.y + 10) + ')')
    .transition()
    .duration(150)
    .attr('opacity', 1)
    .style('display', 'block')
    .attr('transform', 'translate(0, ' + (this.options.y) + ')');
  },

  _onChangePos: function() {
    var pos = this.model.get('pos');

    this.chart
    .transition()
    .duration(150)
    .attr('transform', 'translate(' + (pos.x) + ', ' + (pos.y) + ')');
  },

  _onBrushStart: function() {
    this.chart.classed('is-selectable', true);
  },

  _selectBars: function() {
    var self = this;
    var extent = this.brush.extent();
    var lo = extent[0];
    var hi = extent[1];

    this.model.set({ a: this._getLoBarIndex(), b: this._getHiBarIndex() });

    this.chart.selectAll('.Bar').classed('is-selected', function(d, i) {
      var a = Math.floor(i * self.barWidth);
      var b = Math.floor(a + self.barWidth);
      var LO = Math.floor(self.xScale(lo));
      var HI = Math.floor(self.xScale(hi));
      var isIn = (a > LO && a < HI) || (b > LO && b < HI) || (a <= LO && b >= HI);
      return !isIn;
    });
  },

  _onChangeDragging: function() {
    this.chart.classed('is-dragging', this.model.get('dragging'));
  },

  _onBrushMove: function() {
    this.model.set({ dragging: true });
    this._selectBars();
    this._adjustBrushHandles();
  },

  _onMouseEnter: function() {
  },

  _onMouseOut: function() {
    var bars = this.chart.selectAll('.Bar');
    bars.classed('is-highlighted', false);
    this.trigger('hover', { value: null });
  },

  _onMouseMove: function() {
    var x = d3.event.offsetX;
    var y = d3.event.offsetY;

    var barIndex = Math.floor(x / this.barWidth);
    var data = this.model.get('data');

    if (data[barIndex] === undefined ) return;

    var freq = data[barIndex].freq;

    var format = d3.format('0,000');
    var bar = this.chart.select('.Bar:nth-child(' + (barIndex + 1) + ')');

    var hovered = (barIndex !== undefined) && data[barIndex] && (y > Math.floor(this.yScale(freq)));

    if (bar && bar.node() && !bar.classed('is-selected')) {
      var left = (barIndex * this.barWidth) + (this.barWidth/2) - 25;
      var top = this.yScale(freq) - 10 + this.model.get('pos').y;

      if (!this._isDragging() && hovered) {
        this.trigger('hover', { top: top, left: left, value: freq });
      } else {
        this.trigger('hover', { value: null });
      }

    } else {
      this.trigger('hover', { value: null });
    }

    this.chart.selectAll('.Bar')
    .classed('is-highlighted', false);

    if (hovered && bar && bar.node()) {
      bar.classed('is-highlighted', true);
    }
  },

  _isDragging: function() {
    return this.model.get('dragging');
  },

  move: function(pos) {
    this.model.set({ pos: pos });
  },

  selectRange: function(a, b) {
    var data = this.model.get('data');
    var start = a * (100 / data.length);
    var end = b * (100 / data.length);

    this.chart.select('.Brush').transition()
    .duration(this.brush.empty() ? 0 : 100)
    .call(this.brush.extent([start, end]))
    .call(this.brush.event);
  },

  _selectRange: function(start, end) {
    this.chart.select('.Brush').transition()
    .duration(this.brush.empty() ? 0 : 150)
    .call(this.brush.extent([start, end]))
    .call(this.brush.event);
  },

  _getLoBarIndex: function() {
    var extent = this.brush.extent();
    return Math.round(this.xScale(extent[0]) / this.barWidth);
  },

  _getHiBarIndex: function() {
    var extent = this.brush.extent();
    return Math.round(this.xScale(extent[1]) / this.barWidth);
  },

  _getBarIndex: function() {
    var x = d3.event.sourceEvent.offsetX;
    return Math.floor(x / this.barWidth);
  },

  _setupBrush: function() {
    var self = this;

    var xScale = this.xScale;
    var brush = this.brush = d3.svg.brush().x(this.xScale);

    function onBrushEnd() {
      var data = self.model.get('data');
      var a, b;

      self.model.set({ dragging: false });

      if (brush.empty()) {
        self.chart.selectAll('.Bar').classed('is-selected', false);
        d3.select(this).call(brush.extent([0, 0]));
      } else {

        var loBarIndex = self._getLoBarIndex();
        var hiBarIndex = self._getHiBarIndex();

        a = loBarIndex * (100 / data.length);
        b = hiBarIndex * (100 / data.length);

        if (!d3.event.sourceEvent) {
          return;
        }

        self._selectRange(a, b);
        self.model.set({ a: loBarIndex, b: hiBarIndex });
        self._adjustBrushHandles();
        self._selectBars();

        self.trigger('on_brush_end', self.model.get('a'), self.model.get('b'));
      }

      if (d3.event.sourceEvent && a === undefined && b === undefined) {
        var barIndex = self._getBarIndex();
        a = (barIndex) * (100 / data.length);
        b = (barIndex + 1) * (100 / data.length);
        self.model.set({ a: barIndex, b: barIndex + 1 });
        self._selectRange(a, b);
      }
    }

    var data = this.model.get('data');

    this.brush
    .on('brushstart', this._onBrushStart)
    .on('brush', this._onBrushMove)
    .on('brushend', onBrushEnd);

    this.chart.append('g')
    .attr('class', 'Brush')
    .call(this.brush)
    .selectAll('rect')
    .attr('y', 0)
    .attr('height', this.chartHeight)
    .on('mouseenter', this._onMouseEnter)
    .on('mouseout', this._onMouseOut)
    .on('mousemove', this._onMouseMove);
  },

  _adjustBrushHandles: function() {
    var extent = this.brush.extent();
    var lo = extent[0];
    var hi = extent[1];

    this.leftHandleLine
    .attr('x1', this.xScale(lo))
    .attr('x2', this.xScale(lo));

    this.rightHandleLine
    .attr('x1', this.xScale(hi))
    .attr('x2', this.xScale(hi));

    if (this.options.handles) {
      this.leftHandle
      .attr('x', this.xScale(lo) - this.defaults.handleWidth / 2);

      this.rightHandle
      .attr('x', this.xScale(hi) - this.defaults.handleWidth / 2);
    }
  },

  _generateHandle: function() {
    var handle = { width: this.defaults.handleWidth, height: this.defaults.handleHeight, radius: this.defaults.handleRadius };
    var yPos = (this.chartHeight / 2) - (this.defaults.handleHeight / 2);

    return this.chart.select('.Handles').append('rect')
    .attr('class', 'Handle')
    .attr('transform', 'translate(0, ' + yPos + ')')
    .attr('width', handle.width)
    .attr('height', handle.height)
    .attr('rx', handle.radius)
    .attr('ry', handle.radius);
  },

  _generateHandleLine: function() {
    return this.chart.select('.Handles').append('line')
    .attr('class', 'HandleLine')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 0)
    .attr('y2', this.chartHeight);
  },

  _removeHandles: function() {
    this.chart.select('.Handles').remove();
  },

  _generateHandles: function() {
    this.chart.append('g').attr('class', 'Handles');
    this.leftHandleLine  = this._generateHandleLine();
    this.rightHandleLine = this._generateHandleLine();

    if (this.options.handles) {
      this.leftHandle      = this._generateHandle();
      this.rightHandle     = this._generateHandle();
    }
  },

  _removeXAxis: function() {
    d3.select('.axis').remove();
  },

  _generateXAxis: function() {
    var data = this.model.get('data');

    var format = d3.format('0,000');

    var xAxis = d3.svg.axis()
    .scale(this.zScale)
    .orient('bottom')
    .innerTickSize(0)
    .tickFormat(function(d, i) {
      function calculateBins(n) {
        if (n % 2 === 0) return 4;
        else return 4;
      }

      var p = Math.round(data.length / calculateBins(data.length));
      var v = i % p;

      if (v === 0 || i === 0 || i === (data.length - 1)) {
        var sum = _.reduce(data.slice(0, i + 1), function(memo, d) {
          return d ? d.freq + memo : 0;
        }, 0);
        return format(sum);
      } else {
        return '';
      }
    });

    this.chart.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(0,' + (this.chartHeight + 5) + ')')
    .call(xAxis);
  },

  refreshData: function(data, a, b) {
    if (data && data.length > 0) {
      this.model.set({ data: data, a: a, b: data.length - 1 });
    }
  },

  loadData: function(data) {
    this.model.set({ a: 0, b: 0 }, { silent: true });
    this.model.set('data', data);
    this._onChangeData();
  },

  _onChangeData: function() {
    this._removeBrush();
    this._removeBars();
    this._removeHandles();

    this._setupDimensions();
    this._generateBars();
    this._generateHandles();

    this._removeXAxis();
    this._generateXAxis();

    this._setupBrush();
  },

  _generateBars: function() {
    var self = this;
    var data = this.model.get('data');

    this._calcBarWidth();

    var bars = this.chart.append('g')

    .attr('transform', 'translate(0, 0 )')
    .attr('class', 'Bars')
    .selectAll('.Bar')
    .data(data);


    bars
    .enter()
    .append('rect')
    .attr('class', 'Bar')
    .attr('data', function(d) { return d && d.freq; })
    .attr('transform', function(d, i) {
      return 'translate(' + (i * self.barWidth) + ', 0 )';
    })
    .attr('y', self.chartHeight)
    .attr('height', 0)
    .attr('width', this.barWidth - 1);

    bars.transition()
    .ease(this.defaults.transitionType)
    .duration(self.defaults.duration)
    .delay(function(d, i) {
      return Math.random() * (100 + i * 10);
    })
    .attr('height', function(d) {
      return d ? self.chartHeight - self.yScale(d.freq) : 0;
    })
    .attr('y', function(d) {
      return d ? self.yScale(d.freq) : self.chartHeight;
    });
  },

  _onChangeRange: function() {
    if (this.model.get('a') === 0 && this.model.get('b') === 0) {
      return;
    }
    this.trigger('range_updated', this.model.get('a'), this.model.get('b'));
  },

  _formatNumber: function(value, unit) {
    var format = d3.format("0,000");
    return format(value + unit ? ' ' + unit : '');
  },

});

/**
 *  Default widget content view:
 *
 *
 */

cdb.geo.ui.Widget.Histogram.Content = cdb.geo.ui.Widget.Content.extend({

  defaults: {
    chartHeight: 48
  },

  events: {
    'click .js-clear': '_reset',
    'click .js-zoom': '_zoom'
  },

  _TEMPLATE: ' ' +
   '<div class="Widget-header">'+
      '<div class="Widget-title Widget-contentSpaced">'+
        '<h3 class="Widget-textBig"><%= title %></h3>'+
      '</div>'+
     '<dl class="Widget-info Widget-textSmaller Widget-textSmaller--upper">'+
       '<dt class="Widget-infoItem js-null">0 NULL ROWS</dt>'+
       '<dt class="Widget-infoItem js-min">0 MIN</dt>'+
       '<dt class="Widget-infoItem js-avg">0 AVG</dt>'+
       '<dt class="Widget-infoItem js-max">0 MAX</dt>'+
     '</dl>'+
   '</div>'+
   '<div class="Widget-content js-content">'+
   '<div class="Tooltip js-tooltip"></div>'+
   '  <div class="Widget-filter Widget-contentSpaced js-filter">'+
   '    <p class="Widget-textSmaller Widget-textSmaller--bold Widget-textSmaller--upper js-val"></p>'+
   '    <div class="Widget-filterButtons">'+
   '      <button class="Widget-link Widget-filterButton js-zoom">zoom</button>'+
   '      <button class="Widget-link Widget-filterButton js-clear">clear</button>'+
   '    </div>'+
   '  </div>'+
   '  <svg class="Widget-chart js-chart"></svg>',

  _PLACEHOLDER: ' ' +
    '<ul class="Widget-list Widget-list--withBorders">' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
      '<li class="Widget-listItem Widget-listItem--withBorders Widget-listItem--fake"></li>' +
    '</ul>',

  _initViews: function() {
    this._generateData();
    this._setupDimensions();
    this._generateCanvas();
    this._renderMainChart();
    this._renderMiniChart();
  },

  render: function() {

    this.clearSubViews();

    var template = _.template(this._TEMPLATE);
    var data = this.dataModel.getData();
    var isDataEmpty = _.isEmpty(data) || _.size(data) === 0;

    this.$el.html(
      template({
        title: this.viewModel.get('title'),
        itemsCount: !isDataEmpty ? data.length : '-'
      })
    );

    if (isDataEmpty) {
      this._addPlaceholder();
    } else {
      this._setupBindings();
      this._initViews();
    }

    return this;
  },

  _renderMainChart: function() {
    this.chart = new cdb.geo.ui.Widget.Histogram.Chart(({
      el: this.$('.js-chart'),
      y: 0,
      handles: true,
      width: this.canvasWidth,
      height: this.defaults.chartHeight,
      data: this.dataModel.get('data')
    }));

    this.chart.bind('range_updated', this._onRangeUpdated, this);
    this.chart.bind('hover', this._onValueHover, this);
    this.chart.render().show();

    window.chart = this.chart;
    this._updateStats();
  },

  _renderMiniChart: function() {
    this.miniChart = new cdb.geo.ui.Widget.Histogram.Chart(({
      className: 'mini',
      el: this.$('.js-chart'),
      handles: false,
      width: this.canvasWidth,
      y: 0,
      height: 20,
      data: this.dataModel.get('data')
    }));

    this.miniChart.bind('on_brush_end', this._onMiniRangeUpdated, this);
    this.miniChart.render().hide();
    window.miniChart = this.miniChart;
  },

  _setupBindings: function() {
    this.viewModel.bind('change:zoom_enabled', this._onChangeZoomEnabled, this);
    this.viewModel.bind('change:total', this._onChangeTotal, this);
    this.viewModel.bind('change:max',   this._onChangeMax, this);
    this.viewModel.bind('change:min',   this._onChangeMin, this);
    this.viewModel.bind('change:avg',   this._onChangeAvg, this);
  },

  _setupDimensions: function() {
    this.margin = { top: 0, right: 10, bottom: 20, left: 10 };

    this.canvasWidth  = this.$('.js-chart').width();
    this.canvasHeight = this.defaults.chartHeight + this.margin.top + this.margin.bottom;
  },

  _onValueHover: function(info) {
    var $tooltip = this.$(".js-tooltip");

    if (info.value) {
      $tooltip.css({ top: info.top, left: info.left });
      $tooltip.text(info.value);
      $tooltip.fadeIn(70);
    } else {
      $tooltip.stop().fadeOut(50);
    }
  },

  _onMiniRangeUpdated: function(a, b) {
    this.viewModel.set({ a: a, b: b });
    var data = this._getData();

    var self = this;

    var refreshData = _.debounce(function() {
      self.chart.refreshData(data, a, b);
      self._updateStats();
    }, 100);

    refreshData();
  },

  _onRangeUpdated: function(a, b) {
    this.$(".js-filter").animate({ opacity: 1 }, 250);
    this.viewModel.set({ a: a, b: b });
    this._updateStats();
  },

  _onChangeZoomEnabled: function() {
    this.$(".js-zoom").toggleClass('is-hidden', !this.viewModel.get('zoom_enabled'));
  },

  _onChangeTotal: function() {
    this._animateValue('.js-val', 'total', ' SELECTED');
  },

  _onChangeMax: function() {
    this._animateValue('.js-max', 'max', 'MAX');
  },

  _onChangeMin: function() {
    this._animateValue('.js-min', 'min', 'MIN');
  },

  _onChangeAvg: function() {
    this._animateValue('.js-avg', 'avg', 'AVG');
  },

  _generateData: function() {
    var data = _.map(d3.range(Math.round(Math.random() * 50) + 2), function(d, i) {
      if (Math.round(Math.random() * 100) >= 90) {
        return undefined;
      } else {
        return { bucket: i, freq: Math.round(Math.random() * 1000) };
      }
    });

    this.dataModel.set('data', data);
  },

  _animateValue: function(className, what, unit) {
    var self = this;
    var format = d3.format("0,000");

    var from = this.viewModel.previous(what) || 0;
    var to = this.viewModel.get(what);

    $(className).prop('counter', from).stop().animate({ counter: to }, {
      duration: 500,
      easing: 'swing',
      step: function (i) {
        if (i === isNaN) {
          i = 0;
        }
        var v = Math.floor(i);
        $(this).text(format(v) + ' ' + unit);
      }
    });
  },

  _getData: function(full) {
    var data = this.dataModel.get('data');
    if (full) {
      return data;
    }
    return data.slice(this.viewModel.get('a'), this.viewModel.get('b'));
  },

  _updateStats: function() {
    var data = this._getData();
    var sum = _.reduce(data, function(memo, d) {
      return d ? d.freq + memo : 0;
    }, 0);

    var max = d3.max(data, function(d) { return d && d.freq; });
    var avg = Math.round(d3.mean(data, function(d) { return d && d.freq; }));
    var min = d3.min(data, function(d) { return d && d.freq; });

    this.viewModel.set({ total: sum, min: min, max: max, avg: avg });
  },

  _zoom: function() {
    this._expand();
    this.viewModel.set({ zoom_enabled: false });
    this.chart.loadData(this._getData());
    this.miniChart.selectRange(this.viewModel.get('a'), this.viewModel.get('b'));
    this.miniChart.show();
  },

  _reset: function() {
    this._contract();
    this.viewModel.set({ zoom_enabled: true, a: 0, b: 100 });
    this.chart.reset(this._getData());
    this.$(".js-filter").animate({ opacity: 0 }, 0);
    this.miniChart.hide();
  },

  _contract: function() {
    this.canvas
    .attr('height', this.canvasHeight);
    this.chart.move({ x: 0, y: 0 });
  },

  _expand: function() {
    this.canvas
    .attr('height', this.canvasHeight + 60);
    this.miniChart.show();
    this.chart.move({ x: 0, y: 50 });
  },

  _generateCanvas: function() {
    this.canvas = d3.select(this.$el.find('.js-chart')[0])
    .attr('width',  this.canvasWidth)
    .attr('height', this.canvasHeight);

    this.canvas
    .append('g')
    .attr('class', 'Canvas');
  }
});